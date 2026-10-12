"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as dal from "../dal/quiz";

const answersInput = z.record(z.uuid(), z.array(z.string().max(500)).max(50));

export const submitQuizAction = action(
  { input: z.object({ quizId: z.uuid(), answers: answersInput }) },
  async ({ quizId, answers }, { user }) => {
    const res = await dal.submitQuiz(user, quizId, answers);
    if (res.passed) {
      revalidatePath("/[locale]/student", "page");
      revalidatePath("/[locale]/student/achievements", "page");
    }
    return res;
  },
);
