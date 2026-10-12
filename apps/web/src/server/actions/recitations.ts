"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "../errors";
import { action } from "../action";
import * as dal from "../dal/recitations";

const intField = (name: string, min: number, max: number) =>
  z.coerce.number({ error: name }).int().min(min).max(max);

const formSchema = z.object({
  studentId: z.string().min(1).max(100),
  surah: intField("surah", 1, 114),
  ayahFrom: intField("ayahFrom", 1, 286),
  ayahTo: intField("ayahTo", 1, 286),
  hifzEntryId: z.uuid().optional(),
  homeworkId: z.uuid().optional(),
  durationSec: z.coerce.number().min(0).max(3600).optional(),
  requestAi: z.enum(["true", "false"]).default("false"),
});

/**
 * FormData fields: file (audio Blob), studentId, surah, ayahFrom, ayahTo,
 * optional hifzEntryId / homeworkId / durationSec / requestAi ("true"|"false").
 * Body limit is 25mb (next.config serverActions.bodySizeLimit).
 */
export const submitRecitationAction = action(
  { input: z.instanceof(FormData), roles: ["student", "parent"], rateLimit: "upload.recitation" },
  async (form, { user }) => {
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new AppError("validation", "file", { file: ["required"] });
    const raw = Object.fromEntries(
      [...form.entries()].filter(([k, v]) => k !== "file" && typeof v === "string" && v !== ""),
    );
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("validation", "form");
    const f = parsed.data;
    const res = await dal.createRecitation(user, {
      studentId: f.studentId,
      surah: f.surah,
      ayahFrom: f.ayahFrom,
      ayahTo: f.ayahTo,
      hifzEntryId: f.hifzEntryId,
      homeworkId: f.homeworkId,
      durationSec: f.durationSec,
      requestAi: f.requestAi === "true",
      file: { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type, size: file.size },
    });
    revalidatePath("/[locale]/student/recitations", "page");
    revalidatePath("/[locale]/student/homework", "page");
    revalidatePath("/[locale]/parent/progress", "page");
    revalidatePath("/[locale]/tutor/reviews", "page");
    return res;
  },
);

export const requestAiFeedbackAction = action(
  { input: z.object({ recitationId: z.uuid() }), rateLimit: "ai.recitation", flag: "ai_recitation_feedback" },
  async ({ recitationId }, { user }) => {
    const res = await dal.requestAiFeedback(user, recitationId);
    revalidatePath("/[locale]/student/recitations", "page");
    return res;
  },
);

export const reviewRecitationAction = action(
  {
    input: z.object({
      recitationId: z.uuid(),
      score: z.number().int().min(1).max(5),
      feedback: z.string().trim().max(2000).nullable(),
      status: z.enum(["reviewed", "needs_redo"]),
      hifzStatus: z.enum(["learning", "memorized", "needs_review"]).nullish(),
    }),
    roles: ["tutor", "admin"],
  },
  async ({ recitationId, ...rest }, { user }) => {
    const res = await dal.reviewRecitation(user, recitationId, rest);
    revalidatePath("/[locale]/tutor/reviews", "page");
    revalidatePath("/[locale]/tutor", "page");
    return res;
  },
);
