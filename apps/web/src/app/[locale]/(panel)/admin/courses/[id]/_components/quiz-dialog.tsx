"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { I18nFields, emptyI18n, toI18nValue, type I18nValue } from "@/components/catalog/i18n-fields";
import { useRunAction } from "@/components/catalog/use-run-action";
import { QUESTION_TYPES } from "@/lib/catalog-schemas";
import {
  deleteQuestionAction,
  deleteQuizAction,
  reorderAction,
  saveQuestionAction,
  saveQuizAction,
} from "@/server/actions/catalog";
import type { EditorLesson, EditorQuiz } from "@/server/dal/catalog";

type QType = (typeof QUESTION_TYPES)[number];

const rid = () => crypto.randomUUID().slice(0, 8);

// ───────────── Quiz dialog ─────────────

export function QuizDialog({ lesson, onClose }: { lesson: EditorLesson; onClose: () => void }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useRunAction();
  const quiz: EditorQuiz | undefined = lesson.quizzes[0];

  const [title, setTitle] = useState<I18nValue>(quiz ? toI18nValue(quiz.title) : { ...emptyI18n(), en: t18n(lesson.title, "en") });
  const [passPct, setPassPct] = useState(Math.round((quiz?.passScore ?? 0.7) * 100).toString());
  const [timeMin, setTimeMin] = useState(quiz?.timeLimitSec ? Math.round(quiz.timeLimitSec / 60).toString() : "");
  const [shuffle, setShuffle] = useState(quiz?.shuffle ?? true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  async function saveQuiz() {
    setSaving(true);
    await run(() =>
      saveQuizAction({
        id: quiz?.id,
        lessonId: lesson.id,
        title,
        kind: "lesson",
        passScore: Math.min(100, Math.max(0, Number(passPct) || 0)) / 100,
        timeLimitSec: timeMin.trim() === "" ? null : Math.round(Number(timeMin) * 60),
        shuffle,
      }),
    );
    setSaving(false);
  }

  async function removeQuiz() {
    if (!quiz || !window.confirm(t("confirmDeleteQuiz"))) return;
    const res = await run(() => deleteQuizAction({ id: quiz.id }));
    if (res.ok) onClose();
  }

  async function moveQuestion(index: number, dir: -1 | 1) {
    if (!quiz) return;
    const ids = quiz.questions.map((q) => q.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    await run(() => reorderAction({ entity: "questions", ids }), { success: false });
  }

  const editingQuestion = editing && editing !== "new" ? quiz?.questions.find((q) => q.id === editing) : undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" title={t("quiz")} description={t18n(lesson.title, locale)}>
        <div className="grid gap-5">
          <I18nFields label={t("quizTitle")} required value={title} onChange={setTitle} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("passScore")} hint={t("passScoreHint")}>
              <Input type="number" min={0} max={100} value={passPct} onChange={(e) => setPassPct(e.target.value)} />
            </Field>
            <Field label={t("timeLimitMin")} hint={t("optionalHint")}>
              <Input type="number" min={1} value={timeMin} onChange={(e) => setTimeMin(e.target.value)} />
            </Field>
            <div className="flex items-end pb-2">
              <Switch label={t("shuffleOptions")} checked={shuffle} onCheckedChange={setShuffle} />
            </div>
          </div>
          <div className="flex justify-between gap-2">
            {quiz ? (
              <Button variant="danger" size="sm" onClick={removeQuiz}>
                <Trash2 className="size-4" /> {t("deleteQuiz")}
              </Button>
            ) : (
              <span />
            )}
            <Button loading={saving} onClick={saveQuiz}>
              {quiz ? tc("save") : t("createQuiz")}
            </Button>
          </div>
        </div>

        {quiz && (
          <div className="mt-6 border-t border-border pt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">{t("questions", { count: quiz.questions.length })}</p>
              {editing === null && (
                <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
                  <Plus className="size-4" /> {t("addQuestion")}
                </Button>
              )}
            </div>

            {editing !== null ? (
              <QuestionEditor
                key={editing}
                quizId={quiz.id}
                question={editingQuestion}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="grid gap-2">
                {quiz.questions.length === 0 && <p className="text-sm text-muted">{t("noQuestions")}</p>}
                {quiz.questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                    <span className="w-6 text-sm tabular-nums text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t18n(q.prompt, locale)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge>{t(`questionType_${q.type}`)}</Badge>
                        {q.skill && <Badge tone="primary">{q.skill}</Badge>}
                        <Badge tone="neutral">{t("difficultyN", { n: q.difficulty })}</Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" aria-label={t("moveUp")} disabled={i === 0} onClick={() => moveQuestion(i, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={t("moveDown")} disabled={i === quiz.questions.length - 1} onClick={() => moveQuestion(i, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={tc("edit")} onClick={() => setEditing(q.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={tc("delete")} onClick={() => run(() => deleteQuestionAction({ id: q.id }))}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Question editor ─────────────

type OptionDraft = { id: string; label: I18nValue; audioPath: string };
type PairDraft = { id: string; left: I18nValue; right: I18nValue };

const TRUE_FALSE_OPTIONS = [
  { id: "true", label: { en: "True", ar: "صحيح", tr: "Doğru" } },
  { id: "false", label: { en: "False", ar: "خطأ", tr: "Yanlış" } },
];

function QuestionEditor({
  quizId,
  question,
  onDone,
}: {
  quizId: string;
  question: EditorQuiz["questions"][number] | undefined;
  onDone: () => void;
}) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const run = useRunAction();
  const q = question;

  const [type, setType] = useState<QType>(q?.type ?? "single");
  const [prompt, setPrompt] = useState<I18nValue>(toI18nValue(q?.prompt));
  const [promptAudio, setPromptAudio] = useState(q?.promptAudioPath ?? "");
  const [options, setOptions] = useState<OptionDraft[]>(() => {
    if (q && q.type !== "match" && q.type !== "text" && q.type !== "true_false") {
      return q.options.map((o) => ({ id: o.id, label: toI18nValue(o.label), audioPath: o.audioPath ?? "" }));
    }
    return [
      { id: rid(), label: emptyI18n(), audioPath: "" },
      { id: rid(), label: emptyI18n(), audioPath: "" },
    ];
  });
  const [correct, setCorrect] = useState<string[]>(() => (q && q.type !== "text" && q.type !== "match" && q.type !== "order" ? q.answer : []));
  const [accepted, setAccepted] = useState(q?.type === "text" ? q.answer.join("\n") : "");
  const [pairs, setPairs] = useState<PairDraft[]>(() => {
    if (q?.type === "match") {
      return q.answer.map((a) => {
        const [l, r] = a.split(":");
        return {
          id: l!.replace(/^l-/, ""),
          left: toI18nValue(q.options.find((o) => o.id === l)?.label),
          right: toI18nValue(q.options.find((o) => o.id === r)?.label),
        };
      });
    }
    return [
      { id: rid(), left: emptyI18n(), right: emptyI18n() },
      { id: rid(), left: emptyI18n(), right: emptyI18n() },
    ];
  });
  const [skill, setSkill] = useState(q?.skill ?? "");
  const [difficulty, setDifficulty] = useState((q?.difficulty ?? 1).toString());
  const [points, setPoints] = useState((q?.points ?? 1).toString());
  const [explanation, setExplanation] = useState<I18nValue>(toI18nValue(q?.explanation));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const isChoice = type === "single" || type === "multiple" || type === "audio_choice";

  function changeType(next: QType) {
    setType(next);
    setCorrect([]);
  }

  function toggleCorrect(id: string) {
    if (type === "multiple") setCorrect((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    else setCorrect([id]);
  }

  function build() {
    const nonEmpty = (v: I18nValue) => v.en.trim().length > 0;
    switch (type) {
      case "single":
      case "multiple":
      case "audio_choice": {
        if (options.length < 2 || !options.every((o) => nonEmpty(o.label))) return null;
        const ans = correct.filter((c) => options.some((o) => o.id === c));
        if (ans.length === 0) return null;
        return {
          options: options.map((o) => ({ id: o.id, label: o.label, audioPath: o.audioPath.trim() || undefined })),
          answer: ans,
        };
      }
      case "true_false": {
        const a = correct[0] === "true" || correct[0] === "false" ? correct[0] : null;
        return a ? { options: TRUE_FALSE_OPTIONS, answer: [a] } : null;
      }
      case "text": {
        const ans = accepted.split("\n").map((l) => l.trim()).filter(Boolean);
        return ans.length ? { options: [], answer: ans } : null;
      }
      case "order": {
        if (options.length < 2 || !options.every((o) => nonEmpty(o.label))) return null;
        return { options: options.map((o) => ({ id: o.id, label: o.label })), answer: options.map((o) => o.id) };
      }
      case "match": {
        if (pairs.length < 2 || !pairs.every((p) => nonEmpty(p.left) && nonEmpty(p.right))) return null;
        return {
          options: pairs.flatMap((p) => [
            { id: `l-${p.id}`, label: p.left },
            { id: `r-${p.id}`, label: p.right },
          ]),
          answer: pairs.map((p) => `l-${p.id}:r-${p.id}`),
        };
      }
    }
  }

  async function save() {
    const built = build();
    if (!built) {
      toast.error(t("questionInvalid"));
      return;
    }
    setSaving(true);
    const res = await run(() =>
      saveQuestionAction({
        id: q?.id,
        quizId,
        type,
        prompt,
        promptAudioPath: type === "audio_choice" ? promptAudio : "",
        options: built.options,
        answer: built.answer,
        explanation,
        skill,
        difficulty: Number(difficulty) || 1,
        points: Number(points) || 1,
      }),
    );
    setSaving(false);
    if (res.ok) onDone();
    else setErrors(res.error.fieldErrors ?? {});
  }

  const updateOption = (id: string, patch: Partial<OptionDraft>) =>
    setOptions((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const updatePair = (id: string, patch: Partial<PairDraft>) =>
    setPairs((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="grid gap-5 rounded-lg border border-border p-4">
      <Field label={t("questionTypeLabel")}>
        <Select
          value={type}
          onChange={(v) => v && changeType(v as QType)}
          options={QUESTION_TYPES.map((x) => ({ value: x, label: t(`questionType_${x}`) }))}
        />
      </Field>
      <I18nFields label={t("prompt")} required multiline value={prompt} error={errors["prompt.en"] ?? errors["prompt"]} onChange={setPrompt} />
      {type === "audio_choice" && (
        <Field label={t("promptAudioPath")} hint={t("assetPathHint")}>
          <Input value={promptAudio} dir="ltr" onChange={(e) => setPromptAudio(e.target.value)} />
        </Field>
      )}

      {(isChoice || type === "order") && (
        <div className="grid gap-3">
          <p className="text-sm font-medium">{type === "order" ? t("orderItems") : t("options")}</p>
          <p className="text-xs text-muted">{type === "order" ? t("orderHint") : type === "multiple" ? t("multipleHint") : t("singleHint")}</p>
          {options.map((o, i) => (
            <div key={o.id} className="grid gap-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                {isChoice && (
                  <Switch
                    checked={correct.includes(o.id)}
                    aria-label={t("markCorrect")}
                    onCheckedChange={() => toggleCorrect(o.id)}
                  />
                )}
                <span className="text-sm text-muted">{i + 1}</span>
                <div className="flex-1" />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={tc("remove")}
                  disabled={options.length <= 2}
                  onClick={() => {
                    setOptions((os) => os.filter((x) => x.id !== o.id));
                    setCorrect((c) => c.filter((x) => x !== o.id));
                  }}
                >
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </div>
              <I18nFields label={t("optionLabel")} value={o.label} onChange={(label) => updateOption(o.id, { label })} />
              {type === "audio_choice" && (
                <Field label={t("optionAudioPath")}>
                  <Input value={o.audioPath} dir="ltr" onChange={(e) => updateOption(o.id, { audioPath: e.target.value })} />
                </Field>
              )}
            </div>
          ))}
          <div>
            <Button size="sm" variant="secondary" onClick={() => setOptions((os) => [...os, { id: rid(), label: emptyI18n(), audioPath: "" }])}>
              <Plus className="size-4" /> {t("addOption")}
            </Button>
          </div>
        </div>
      )}

      {type === "true_false" && (
        <Field label={t("correctAnswer")}>
          <Select
            value={correct[0] ?? null}
            onChange={(v) => setCorrect(v ? [v] : [])}
            options={[
              { value: "true", label: TRUE_FALSE_OPTIONS[0]!.label.en },
              { value: "false", label: TRUE_FALSE_OPTIONS[1]!.label.en },
            ]}
          />
        </Field>
      )}

      {type === "text" && (
        <Field label={t("acceptedAnswers")} hint={t("acceptedAnswersHint")}>
          <Textarea value={accepted} onChange={(e) => setAccepted(e.target.value)} />
        </Field>
      )}

      {type === "match" && (
        <div className="grid gap-3">
          <p className="text-sm font-medium">{t("pairs")}</p>
          <p className="text-xs text-muted">{t("matchHint")}</p>
          {pairs.map((p) => (
            <div key={p.id} className="grid gap-2 rounded-md border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <I18nFields label={t("pairLeft")} value={p.left} onChange={(left) => updatePair(p.id, { left })} />
                <I18nFields label={t("pairRight")} value={p.right} onChange={(right) => updatePair(p.id, { right })} />
              </div>
              <div>
                <Button size="sm" variant="ghost" disabled={pairs.length <= 2} onClick={() => setPairs((ps) => ps.filter((x) => x.id !== p.id))}>
                  <Trash2 className="size-4 text-danger" /> {tc("remove")}
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button size="sm" variant="secondary" onClick={() => setPairs((ps) => [...ps, { id: rid(), left: emptyI18n(), right: emptyI18n() }])}>
              <Plus className="size-4" /> {t("addPair")}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("skill")} hint={t("skillHint")}>
          <Input value={skill} dir="ltr" onChange={(e) => setSkill(e.target.value)} />
        </Field>
        <Field label={t("difficulty")}>
          <Select
            value={difficulty}
            onChange={(v) => v && setDifficulty(v)}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Field>
        <Field label={t("points")}>
          <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(e.target.value)} />
        </Field>
      </div>
      <I18nFields label={t("explanation")} multiline value={explanation} onChange={setExplanation} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>{tc("cancel")}</Button>
        <Button loading={saving} onClick={save}>{tc("save")}</Button>
      </div>
    </div>
  );
}
