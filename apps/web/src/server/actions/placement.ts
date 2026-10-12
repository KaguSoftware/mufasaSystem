"use server";

import { z } from "zod";
import { action } from "../action";
import * as dal from "../dal/placement";

const answers = z.record(z.uuid(), z.array(z.string().max(500)).max(50));

export const submitPlacementAction = action(
  { input: z.object({ studentId: z.string().min(1), answers }), flag: "placement_test" },
  async ({ studentId, answers }, { user }) => dal.submitPlacement(user, studentId, answers),
);

export const enrollRecommendedAction = action(
  { input: z.object({ studentId: z.string().min(1), courseIds: z.array(z.uuid()).max(10) }), flag: "placement_test" },
  async ({ studentId, courseIds }, { user }) => dal.enrollRecommended(user, studentId, courseIds),
);
