"use client";

import { Mic, Rocket, Save, Sparkles, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useErrorText } from "@/components/account/use-action-error";
import type { ActionError } from "@/server/action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Switch } from "@/components/ui/controls";
import { Field, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import {
  generateScenes,
  getProjectStatus,
  publishProject,
  renderProject,
  updateProjectScenes,
  voiceProject,
} from "@/server/actions/studio";
import { boardAction, MASCOT_POSES, sceneDocumentSchema, type SceneDocument } from "@mufasa/video/schema";
import { z } from "zod";
import { DEFAULT_VOICE_BY_LOCALE, STUDIO_VOICES } from "@/lib/studio-voices";
import { ScenePlayer } from "./scene-player";

type Pose = (typeof MASCOT_POSES)[number];
type Position = "left" | "right" | "hidden";
type SceneEdit = { id: string; narration: string; pose: Pose; position: Position; clear: boolean; actionsText: string };
type Status = "draft" | "scenes_ready" | "voicing" | "voiced" | "rendering" | "rendered" | "published" | "failed";

export type ProjectEditorProps = {
  base: string;
  project: { id: string; title: string; status: Status; voice: string | null; locale: string; scriptId: string | null };
  doc: SceneDocument | null;
  audioUrls: Record<string, { src: string; durationSec: number }>;
  outputUrl: string | null;
  lesson: { id: string; title: string } | null;
};

const actionsSchema = z.array(boardAction).max(30);

function toEdits(doc: SceneDocument): SceneEdit[] {
  return doc.scenes.map((s) => ({
    id: s.id,
    narration: s.narration,
    pose: s.mascot.pose,
    position: s.mascot.position,
    clear: s.clearBoardBefore,
    actionsText: JSON.stringify(s.actions, null, 2),
  }));
}

/** Assemble and validate the document from the editor state. Errors are per scene id. */
function assemble(base: SceneDocument, edits: SceneEdit[]): { doc: SceneDocument | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const scenes = edits.map((e) => {
    let actions: unknown = [];
    try {
      actions = JSON.parse(e.actionsText || "[]");
    } catch {
      errors[e.id] = "json";
    }
    if (!errors[e.id]) {
      const r = actionsSchema.safeParse(actions);
      if (!r.success) errors[e.id] = r.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
      else actions = r.data;
    }
    const prev = base.scenes.find((s) => s.id === e.id);
    return {
      id: e.id,
      narration: e.narration,
      durationSec: prev && prev.narration === e.narration ? prev.durationSec : undefined,
      mascot: { pose: e.pose, position: e.position },
      clearBoardBefore: e.clear,
      actions,
    };
  });
  if (Object.keys(errors).length) return { doc: null, errors };
  const parsed = sceneDocumentSchema.safeParse({ ...base, scenes });
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const idx = typeof i.path[1] === "number" ? i.path[1] : -1;
      const id = edits[idx]?.id ?? "_";
      errors[id] = `${i.path.slice(2).join(".")}: ${i.message}`;
    }
    return { doc: null, errors };
  }
  return { doc: parsed.data, errors };
}

export function ProjectEditor(props: ProjectEditorProps) {
  const t = useTranslations("studio");
  const errText = useErrorText();
  const router = useRouter();
  const { project, doc: initialDoc } = props;

  const [edits, setEdits] = useState<SceneEdit[]>(() => (initialDoc ? toEdits(initialDoc) : []));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(edits));
  const [voice, setVoice] = useState(project.voice ?? DEFAULT_VOICE_BY_LOCALE[(project.locale as "ar" | "en" | "tr") ?? "ar"] ?? "Kore");
  const [allowSilent, setAllowSilent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [live, setLive] = useState<{ status: Status; progress: number; error: string | null; outputUrl: string | null }>({
    status: project.status,
    progress: 0,
    error: null,
    outputUrl: props.outputUrl,
  });
  const lastBusy = useRef(project.status === "voicing" || project.status === "rendering");

  const built = useMemo(() => (initialDoc ? assemble(initialDoc, edits) : { doc: null, errors: {} as Record<string, string> }), [initialDoc, edits]);
  // keep showing the last valid document while the JSON is being edited
  const [previewDoc, setPreviewDoc] = useState<SceneDocument | null>(initialDoc);
  if (built.doc && built.doc !== previewDoc) setPreviewDoc(built.doc);

  const dirty = JSON.stringify(edits) !== savedJson;
  const hasErrors = Object.keys(built.errors).length > 0;
  const running = live.status === "voicing" || live.status === "rendering";
  const missingVoice = initialDoc ? initialDoc.scenes.filter((s) => !props.audioUrls[s.id]).length : 0;

  // Poll the newest job every 3s while something is running.
  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      const res = await getProjectStatus({ projectId: project.id });
      if (stop || !res.ok) return;
      setLive({ status: res.data.status, progress: res.data.job?.progress ?? 0, error: res.data.job?.error ?? null, outputUrl: res.data.outputUrl });
    };
    void tick();
    const timer = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [running, project.id]);

  useEffect(() => {
    if (lastBusy.current && !running) router.refresh(); // pick up fresh audio / video urls
    lastBusy.current = running;
  }, [running, router]);

  if (!initialDoc || !previewDoc) {
    return <p className="text-sm text-muted">{t("noFinalVideo")}</p>;
  }

  const message = (e: ActionError) => (e.code === "conflict" && e.message ? e.message : errText(e));

  function patch(i: number, p: Partial<SceneEdit>) {
    setEdits((all) => all.map((e, k) => (k === i ? { ...e, ...p } : e)));
  }

  async function save(): Promise<boolean> {
    if (!built.doc) {
      toast.error(t("sceneInvalid"));
      return false;
    }
    setBusy("save");
    const res = await updateProjectScenes({ projectId: project.id, sceneJson: built.doc });
    setBusy(null);
    if (!res.ok) {
      toast.error(message(res.error));
      return false;
    }
    setSavedJson(JSON.stringify(edits));
    if (res.data.warnings.length) toast.warning(res.data.warnings.join("\n"));
    else toast.success(t("scenesSaved"));
    router.refresh();
    return true;
  }

  async function voiceIt() {
    setBusy("voice");
    const res = await voiceProject({ projectId: project.id, voice });
    setBusy(null);
    if (!res.ok) return toast.error(message(res.error));
    toast.success(t("voiceStarted"));
    setLive((l) => ({ ...l, status: "voicing", progress: 0, error: null }));
  }

  async function renderIt() {
    setBusy("render");
    const res = await renderProject({ projectId: project.id, allowSilent });
    setBusy(null);
    if (!res.ok) return toast.error(message(res.error));
    toast.success(t("renderStarted"));
    setLive((l) => ({ ...l, status: "rendering", progress: 0, error: null }));
  }

  async function publishIt() {
    setBusy("publish");
    const res = await publishProject({ projectId: project.id });
    setBusy(null);
    if (!res.ok) return toast.error(message(res.error));
    toast.success(t("publishedOk"));
    setLive((l) => ({ ...l, status: "published" }));
    router.refresh();
  }

  async function regenerate() {
    if (!project.scriptId) return;
    setBusy("regen");
    const res = await generateScenes({ scriptId: project.scriptId, projectId: project.id });
    setBusy(null);
    if (!res.ok) return toast.error(message(res.error));
    toast.success(t("scenesGenerated"));
    if (res.data.warnings.length) toast.warning(res.data.warnings.join("\n"));
    router.refresh();
  }

  const tone = live.status === "published" ? "success" : live.status === "failed" ? "danger" : "primary";
  const canRender = !dirty && !running && !hasErrors && (missingVoice === 0 || allowSilent);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_480px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <Badge tone={tone}>{t(`status_${live.status}`)}</Badge>
        </div>

        <Card>
          <CardHeader title={t("preview")} description={hasErrors ? t("previewInvalid") : undefined} />
          <CardBody>
            <ScenePlayer doc={previewDoc} audio={props.audioUrls} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("finalVideo")} />
          <CardBody className="flex flex-col gap-3">
            {live.outputUrl ? (
              <video src={live.outputUrl} controls className="w-full rounded-md bg-black" style={{ aspectRatio: "16 / 9" }} />
            ) : (
              <p className="text-sm text-muted">{t("noFinalVideo")}</p>
            )}
            {running && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted">
                  {t(`status_${live.status}`)} · {t("progress")}: {Math.round(live.progress)}%
                </p>
                <Progress value={live.progress} />
              </div>
            )}
            {live.status === "failed" && <p className="text-sm text-danger">{t("jobFailed")}{live.error ? `: ${live.error}` : ""}</p>}
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title={t("voice")} />
          <CardBody className="flex flex-col gap-3">
            <Select
              value={voice}
              onChange={(v) => v && setVoice(v)}
              options={STUDIO_VOICES.map((v) => ({ value: v.id, label: v.id, description: v.style }))}
            />
            {dirty && <p className="text-sm text-warning">{t("saveFirst")}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={voiceIt} loading={busy === "voice"} disabled={dirty || running || hasErrors}>
                <Mic className="size-4" />
                {t("generateVoice")}
              </Button>
              <Button onClick={renderIt} loading={busy === "render"} disabled={!canRender}>
                <Video className="size-4" />
                {t("render")}
              </Button>
              <Button
                variant="outline"
                onClick={publishIt}
                loading={busy === "publish"}
                disabled={running || !(live.status === "rendered" || live.status === "published") || !props.lesson}
              >
                <Rocket className="size-4" />
                {t("publish")}
              </Button>
            </div>
            {missingVoice > 0 && (
              <div className="flex flex-col gap-1">
                <Checkbox checked={allowSilent} onCheckedChange={(v) => setAllowSilent(v === true)} label={t("renderSilent")} />
                <p className="text-xs text-muted">{t("silentHint")}</p>
              </div>
            )}
            <p className="text-sm text-muted">
              {t("linkedLesson")}: {props.lesson ? props.lesson.title : t("noLinkedLesson")}
            </p>
            {project.scriptId && (
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={regenerate} loading={busy === "regen"} disabled={running}>
                  <Sparkles className="size-4" />
                  {t("regenerate")}
                </Button>
                <p className="text-xs text-muted">{t("regenerateHint")}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("scenes")}</h2>
          <Button size="sm" onClick={save} loading={busy === "save"} disabled={!dirty || hasErrors || running}>
            <Save className="size-4" />
            {t("saveScenes")}
          </Button>
        </div>
        {dirty && <p className="text-sm text-warning">{t("unsaved")}</p>}

        {edits.map((e, i) => {
          const err = built.errors[e.id];
          return (
            <Card key={e.id}>
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{t("scene", { n: i + 1 })}</p>
                  <code className="text-xs text-muted">{e.id}</code>
                </div>
                <Field label={t("narration")}>
                  <Textarea value={e.narration} onChange={(ev) => patch(i, { narration: ev.target.value })} rows={3} dir="auto" disabled={running} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("mascotPose")}>
                    <Select
                      value={e.pose}
                      onChange={(v) => v && patch(i, { pose: v as Pose })}
                      options={MASCOT_POSES.map((p) => ({ value: p, label: t(`pose_${p}`) }))}
                    />
                  </Field>
                  <Field label={t("mascotPosition")}>
                    <Select
                      value={e.position}
                      onChange={(v) => v && patch(i, { position: v as Position })}
                      options={(["left", "right", "hidden"] as const).map((p) => ({ value: p, label: t(`pos_${p}`) }))}
                    />
                  </Field>
                </div>
                <Switch checked={e.clear} onCheckedChange={(v) => patch(i, { clear: v })} label={t("clearBoard")} />
                <Field label={t("actionsJson")} hint={t("actionsHint")} error={err ? (err === "json" ? t("jsonInvalid") : err) : undefined}>
                  <Textarea
                    value={e.actionsText}
                    onChange={(ev) => patch(i, { actionsText: ev.target.value })}
                    rows={8}
                    dir="ltr"
                    spellCheck={false}
                    aria-invalid={Boolean(err)}
                    className="font-mono text-xs"
                    disabled={running}
                  />
                </Field>
              </CardBody>
            </Card>
          );
        })}
        <p className="text-sm">
          <Link href={props.base} className="text-primary hover:underline">
            {t("backToStudio")}
          </Link>
        </p>
      </div>
    </div>
  );
}
