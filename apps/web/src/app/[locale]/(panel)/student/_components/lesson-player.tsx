"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { SimpleMarkdown } from "@/components/catalog/simple-markdown";
import { Link } from "@/i18n/navigation";
import { errorMessageKey } from "@/server/errors";
import { markLessonCompleteAction, recordProgressAction } from "@/server/actions/learn";
import type { PlayerLesson } from "@/server/dal/learn";

const PING_EVERY_MS = 10_000;

export function LessonPlayer({ lesson }: { lesson: PlayerLesson }) {
  const t = useTranslations("learn");
  const te = useTranslations("errors");
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPing = useRef(0);
  const sending = useRef(false);
  const [percent, setPercent] = useState(lesson.progress.percent);
  const [completed, setCompleted] = useState(lesson.progress.completed);
  const [marking, setMarking] = useState(false);

  const announce = useCallback(
    (res: { justCompleted: boolean; courseCompleted: boolean }) => {
      if (res.justCompleted) toast.success(t("lessonCompletedToast", { xp: lesson.xpReward }));
      if (res.courseCompleted) toast.success(t("courseCompletedToast"));
    },
    [lesson.xpReward, t],
  );

  const send = useCallback(
    async (force = false) => {
      const v = videoRef.current;
      if (!v || sending.current) return;
      const now = Date.now();
      if (!force && now - lastPing.current < PING_EVERY_MS) return;
      const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : (lesson.durationSec ?? 0);
      if (duration <= 0) return;
      lastPing.current = now;
      sending.current = true;
      try {
        const res = await recordProgressAction({ lessonId: lesson.id, positionSec: v.currentTime, durationSec: duration });
        if (res.ok) {
          setPercent((p) => Math.max(p, res.data.percent));
          if (res.data.completed) setCompleted(true);
          announce(res.data);
        }
      } finally {
        sending.current = false;
      }
    },
    [announce, lesson.durationSec, lesson.id],
  );

  // Flush the last position when the learner leaves the page.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void send(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [send]);

  async function markComplete() {
    setMarking(true);
    const res = await markLessonCompleteAction({ lessonId: lesson.id });
    setMarking(false);
    if (res.ok) {
      setCompleted(true);
      setPercent(100);
      announce(res.data);
    } else {
      toast.error(te(errorMessageKey[res.error.code] as Parameters<typeof te>[0]));
    }
  }

  const body = t18n(lesson.body, locale);
  const hasVideo = lesson.type === "video" || Boolean(lesson.videoUrl);

  return (
    <div className="grid gap-6">
      {hasVideo && (
        <Card>
          <CardBody className="p-0">
            {lesson.videoUrl ? (
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                src={lesson.videoUrl}
                className="aspect-video w-full rounded-lg bg-black"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (lesson.progress.positionSec > 0 && lesson.progress.positionSec < v.duration - 5) {
                    v.currentTime = lesson.progress.positionSec;
                  }
                }}
                onTimeUpdate={() => void send()}
                onPause={() => void send(true)}
                onEnded={() => void send(true)}
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-surface-2 text-sm text-muted">
                {t("videoUnavailable")}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-40 flex-1">
          <Progress value={percent} />
        </div>
        <span className="text-sm tabular-nums text-muted">{percent}%</span>
        {completed ? (
          <Badge tone="success">
            <CheckCircle2 className="size-3.5" /> {t("completed")}
          </Badge>
        ) : (
          <Badge>{t("xpReward", { xp: lesson.xpReward })}</Badge>
        )}
        {!completed && !hasVideo && (
          <Button size="sm" loading={marking} onClick={markComplete}>
            {t("markComplete")}
          </Button>
        )}
      </div>

      {body && (
        <Card>
          <CardBody>
            <SimpleMarkdown source={body} className="grid gap-3" />
          </CardBody>
        </Card>
      )}

      {lesson.assets.length > 0 && (
        <Card>
          <CardHeader title={t("resources")} />
          <div className="divide-y divide-border">
            {lesson.assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-muted" />
                  {t18n(a.title, locale)}
                </span>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                    {t("open")} <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-muted">{t("unavailable")}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function LessonNav({ prevId, nextId }: { prevId: string | null; nextId: string | null }) {
  const t = useTranslations("learn");
  return (
    <div className="flex items-center justify-between gap-3">
      {prevId ? (
        <Button asChild variant="secondary">
          <Link href={`/student/learn/${prevId}`}>
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t("previousLesson")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      {nextId && (
        <Button asChild>
          <Link href={`/student/learn/${nextId}`}>
            {t("nextLesson")} <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </Button>
      )}
    </div>
  );
}
