"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as dal from "../dal/learn";

export const enrollAction = action(
  { input: z.object({ studentId: z.string().min(1), courseId: z.uuid() }) },
  async ({ studentId, courseId }, { user }) => {
    const res = await dal.enroll(user, studentId, courseId);
    revalidatePath("/[locale]/student/courses", "page");
    return res;
  },
);

/** Throttled client side (about every 10s and on pause / end). */
export const recordProgressAction = action(
  {
    input: z.object({
      lessonId: z.uuid(),
      positionSec: z.number().min(0).max(60 * 60 * 24),
      durationSec: z.number().min(0).max(60 * 60 * 24),
    }),
  },
  async ({ lessonId, positionSec, durationSec }, { user }) => {
    const res = await dal.recordProgress(user, lessonId, positionSec, durationSec);
    if (res.justCompleted) {
      revalidatePath("/[locale]/student", "page");
      revalidatePath("/[locale]/student/courses", "page");
    }
    return res;
  },
);

export const markLessonCompleteAction = action({ input: z.object({ lessonId: z.uuid() }) }, async ({ lessonId }, { user }) => {
  const res = await dal.markLessonComplete(user, lessonId);
  revalidatePath("/[locale]/student", "page");
  revalidatePath("/[locale]/student/courses", "page");
  return res;
});
