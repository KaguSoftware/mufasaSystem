"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "../errors";
import { action } from "../action";
import { isParentOf } from "../session";
import * as dal from "../dal/homework";
import * as quizDal from "../dal/quiz";
import { checkAttachment } from "@/lib/homework-attachment";
import { objectPath, storage } from "../storage";
import { enforceRateLimit } from "../rate-limit";

function refresh() {
  revalidatePath("/[locale]/tutor/homework", "page");
  revalidatePath("/[locale]/tutor", "page");
  revalidatePath("/[locale]/student/homework", "page");
  revalidatePath("/[locale]/parent/progress", "page");
}

export const createHomeworkAction = action(
  {
    input: z
      .object({
        groupId: z.uuid().nullish(),
        studentId: z.string().min(1).max(100).nullish(),
        title: z.string().trim().min(1).max(160),
        instructions: z.string().trim().max(4000).nullish(),
        targetType: z.enum(["lesson", "quiz", "recitation", "free"]),
        lessonId: z.uuid().nullish(),
        quizId: z.uuid().nullish(),
        surah: z.number().int().min(1).max(114).nullish(),
        ayahFrom: z.number().int().min(1).max(286).nullish(),
        ayahTo: z.number().int().min(1).max(286).nullish(),
        /** ISO instant. The client converts the picker's local time. */
        dueAt: z.iso.datetime({ offset: true }),
      })
      .refine((v) => Boolean(v.groupId) !== Boolean(v.studentId), { message: "group_or_student", path: ["studentId"] }),
    roles: ["tutor", "admin"],
  },
  async ({ dueAt, ...rest }, { user }) => {
    const res = await dal.createHomework(user, { ...rest, dueAt: new Date(dueAt) });
    refresh();
    return res;
  },
);

export const deleteHomeworkAction = action({ input: z.object({ homeworkId: z.uuid() }), roles: ["tutor", "admin"] }, async ({ homeworkId }, { user }) => {
  const res = await dal.deleteHomework(user, homeworkId);
  refresh();
  return res;
});

export const reviewHomeworkSubmissionAction = action(
  {
    input: z.object({
      submissionId: z.uuid(),
      grade: z.number().int().min(0).max(100).nullable(),
      feedback: z.string().trim().max(2000).nullable(),
      status: z.enum(["reviewed", "returned"]),
    }),
    roles: ["tutor", "admin"],
  },
  async ({ submissionId, ...rest }, { user }) => {
    const res = await dal.reviewHomeworkSubmission(user, submissionId, rest);
    refresh();
    return res;
  },
);

/** FormData: homeworkId, studentId, text?, file? (optional attachment, 10MB). */
export const submitFreeHomeworkAction = action(
  { input: z.instanceof(FormData), roles: ["student", "parent"], rateLimit: "upload.receipt" },
  async (form, { user }) => {
    const homeworkId = String(form.get("homeworkId") ?? "");
    const studentId = String(form.get("studentId") ?? "");
    const text = String(form.get("text") ?? "").trim().slice(0, 5000) || null;
    if (!z.uuid().safeParse(homeworkId).success || !studentId) throw new AppError("validation", "form");
    if (user.id !== studentId && !(user.role === "parent" && (await isParentOf(user.id, studentId)))) throw new AppError("forbidden");

    let attachmentPath: string | null = null;
    const file = form.get("file");
    if (file instanceof Blob && file.size > 0) {
      const check = checkAttachment(file);
      if (!check.ok) throw new AppError("validation", "file", { file: [check.reason] });
      attachmentPath = objectPath(`homework/${studentId}`, check.ext);
      await storage().upload("lessonAssets", attachmentPath, new Uint8Array(await file.arrayBuffer()), check.mime);
    }
    const res = await dal.submitFreeHomework(user, { homeworkId, studentId, text, attachmentPath });
    refresh();
    return res;
  },
);

/**
 * Submit a homework quiz: guards access (student must have homework for it), grades via the
 * quiz DAL, then links the attempt to the homework.
 */
export const submitHomeworkQuizAction = action(
  {
    input: z.object({
      quizId: z.uuid(),
      answers: z.record(z.uuid(), z.array(z.string().max(500)).max(50)),
    }),
    roles: ["student"],
  },
  async ({ quizId, answers }, { user }) => {
    // submitQuiz enforces homework-quiz access and links the attempt to the homework.
    const res = await quizDal.submitQuiz(user, quizId, answers);
    refresh();
    return res;
  },
);
