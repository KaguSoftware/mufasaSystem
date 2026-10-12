"use client";

import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n } from "@mufasa/config/locales";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, RadioGroup } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PlayerQuestion } from "@/server/dal/quiz";

export type AnswerState = Record<string, string[]>;

function initialAnswers(questions: PlayerQuestion[]): AnswerState {
  const a: AnswerState = {};
  // Order questions start in the displayed order so the learner only has to move items.
  for (const q of questions) if (q.type === "order") a[q.id] = q.options.map((o) => o.id);
  return a;
}

/**
 * Renders every question type and collects answers. It never knows the correct
 * answers: grading happens on the server. After submission the parent can pass
 * `results` (per-question correctness) and `explanations` to show feedback.
 */
export function QuestionsForm({
  questions,
  submitting,
  submitLabel,
  results,
  explanations,
  onSubmit,
}: {
  questions: PlayerQuestion[];
  submitting?: boolean;
  submitLabel?: string;
  results?: Record<string, boolean>;
  explanations?: Record<string, { en: string; ar?: string; tr?: string }>;
  onSubmit: (answers: AnswerState) => void | Promise<void>;
}) {
  const t = useTranslations("quiz");
  const locale = useLocale();
  const [answers, setAnswers] = useState<AnswerState>(() => initialAnswers(questions));
  const locked = Boolean(results);

  const set = (id: string, value: string[]) => setAnswers((a) => ({ ...a, [id]: value }));
  const answeredCount = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;

  return (
    <div className="grid gap-4">
      {questions.map((q, i) => {
        const given = answers[q.id] ?? [];
        const verdict = results?.[q.id];
        return (
          <Card key={q.id}>
            <CardBody className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">{t("questionOf", { n: i + 1, total: questions.length })}</p>
                  <p className="mt-1 font-medium leading-relaxed">{t18n(q.prompt, locale)}</p>
                </div>
                {verdict !== undefined &&
                  (verdict ? (
                    <span className="flex items-center gap-1 text-sm text-success"><Check className="size-4" /> {t("correct")}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-danger"><X className="size-4" /> {t("incorrect")}</span>
                  ))}
              </div>
              {q.promptAudioUrl && <audio controls preload="none" src={q.promptAudioUrl} className="w-full" />}

              {(q.type === "single" || q.type === "true_false" || q.type === "audio_choice") && (
                <RadioGroup
                  value={given[0] ?? ""}
                  disabled={locked}
                  onValueChange={(v) => set(q.id, [v])}
                  options={q.options.map((o) => ({
                    value: o.id,
                    label: (
                      <span className="flex flex-col gap-2">
                        {t18n(o.label, locale)}
                        {o.audioUrl && <audio controls preload="none" src={o.audioUrl} />}
                      </span>
                    ),
                  }))}
                />
              )}

              {q.type === "multiple" && (
                <div className="grid gap-2">
                  <p className="text-xs text-muted">{t("selectAll")}</p>
                  {q.options.map((o) => (
                    <Checkbox
                      key={o.id}
                      disabled={locked}
                      checked={given.includes(o.id)}
                      onCheckedChange={(c) => set(q.id, c ? [...given, o.id] : given.filter((x) => x !== o.id))}
                      label={t18n(o.label, locale)}
                    />
                  ))}
                </div>
              )}

              {q.type === "text" && (
                <Input
                  disabled={locked}
                  value={given[0] ?? ""}
                  placeholder={t("typeAnswer")}
                  onChange={(e) => set(q.id, [e.target.value])}
                />
              )}

              {q.type === "order" && (
                <div className="grid gap-2">
                  <p className="text-xs text-muted">{t("orderHint")}</p>
                  {given.map((id, idx) => {
                    const o = q.options.find((x) => x.id === id);
                    const swap = (dir: -1 | 1) => {
                      const next = [...given];
                      const j = idx + dir;
                      if (j < 0 || j >= next.length) return;
                      [next[idx], next[j]] = [next[j]!, next[idx]!];
                      set(q.id, next);
                    };
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                        <span className="w-5 text-sm tabular-nums text-muted">{idx + 1}</span>
                        <span className="flex-1">{o ? t18n(o.label, locale) : id}</span>
                        <Button size="icon" variant="ghost" aria-label={t("moveUp")} disabled={locked || idx === 0} onClick={() => swap(-1)}>
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={t("moveDown")} disabled={locked || idx === given.length - 1} onClick={() => swap(1)}>
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "match" && <MatchInput question={q} given={given} locked={locked} onChange={(v) => set(q.id, v)} />}

              {verdict !== undefined && explanations?.[q.id] && (
                <p className="rounded-md bg-surface-2 p-3 text-sm text-muted">{t18n(explanations[q.id]!, locale)}</p>
              )}
            </CardBody>
          </Card>
        );
      })}

      {!locked && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">{t("answered", { done: answeredCount, total: questions.length })}</span>
          <Button loading={submitting} disabled={answeredCount === 0} onClick={() => onSubmit(answers)}>
            {submitLabel ?? t("submit")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Left items are options with ids "l-*", right choices "r-*". Answer entries are "l-x:r-y". */
function MatchInput({
  question,
  given,
  locked,
  onChange,
}: {
  question: PlayerQuestion;
  given: string[];
  locked: boolean;
  onChange: (v: string[]) => void;
}) {
  const t = useTranslations("quiz");
  const locale = useLocale();
  const lefts = question.options.filter((o) => o.id.startsWith("l-"));
  const rights = question.options.filter((o) => o.id.startsWith("r-"));
  const chosen = (leftId: string) => given.find((g) => g.startsWith(`${leftId}:`))?.split(":")[1] ?? null;

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted">{t("matchHint")}</p>
      {lefts.map((l) => (
        <div key={l.id} className="grid items-center gap-2 sm:grid-cols-2">
          <span className="rounded-md bg-surface-2 px-3 py-2 text-sm">{t18n(l.label, locale)}</span>
          <Select
            disabled={locked}
            value={chosen(l.id)}
            placeholder={t("chooseMatch")}
            options={rights.map((r) => ({ value: r.id, label: t18n(r.label, locale) }))}
            onChange={(v) => {
              const rest = given.filter((g) => !g.startsWith(`${l.id}:`));
              onChange(v ? [...rest, `${l.id}:${v}`] : rest);
            }}
          />
        </div>
      ))}
    </div>
  );
}
