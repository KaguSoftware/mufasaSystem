"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as dal from "../dal/hifz";

const studentId = z.string().min(1).max(100);
const surah = z.number().int().min(1).max(114);
const ayah = z.number().int().min(1).max(286);
const status = z.enum(["learning", "memorized", "needs_review"]);

const planFields = {
  title: z.string().trim().min(1).max(120),
  fromSurah: surah,
  fromAyah: ayah,
  toSurah: surah,
  toAyah: ayah.nullable(),
  weeklyTarget: z.number().int().min(1).max(100),
  direction: z.enum(["forward", "backward"]),
};

function refresh() {
  revalidatePath("/[locale]/student/hifz", "page");
  revalidatePath("/[locale]/tutor/students/[id]", "page");
  revalidatePath("/[locale]/parent/progress", "page");
}

export const createPlanAction = action(
  { input: z.object({ studentId, ...planFields, status: z.enum(["active", "paused", "completed"]).optional() }), roles: ["tutor", "parent", "admin"] },
  async (input, { user }) => {
    const res = await dal.createPlan(user, input);
    refresh();
    return res;
  },
);

export const updatePlanAction = action(
  {
    input: z.object({
      planId: z.uuid(),
      patch: z.object({ ...planFields, status: z.enum(["active", "paused", "completed"]) }).partial(),
    }),
    roles: ["tutor", "parent", "admin"],
  },
  async ({ planId, patch }, { user }) => {
    const res = await dal.updatePlan(user, planId, patch);
    refresh();
    return res;
  },
);

export const deletePlanAction = action({ input: z.object({ planId: z.uuid() }), roles: ["tutor", "parent", "admin"] }, async ({ planId }, { user }) => {
  const res = await dal.deletePlan(user, planId);
  refresh();
  return res;
});

export const createEntryAction = action(
  {
    input: z.object({
      studentId,
      planId: z.uuid().nullish(),
      surah,
      ayahFrom: ayah,
      ayahTo: ayah,
      status: status.optional(),
      grade: z.number().int().min(1).max(5).nullish(),
      note: z.string().trim().max(500).nullish(),
    }),
    roles: ["tutor", "parent", "admin"],
  },
  async (input, { user }) => {
    const res = await dal.createEntry(user, input);
    refresh();
    return res;
  },
);

export const updateEntryAction = action(
  {
    input: z.object({
      entryId: z.uuid(),
      patch: z.object({
        status: status.optional(),
        grade: z.number().int().min(1).max(5).nullable().optional(),
        note: z.string().trim().max(500).nullable().optional(),
        ayahFrom: ayah.optional(),
        ayahTo: ayah.optional(),
      }),
    }),
    roles: ["tutor", "parent", "admin"],
  },
  async ({ entryId, patch }, { user }) => {
    const res = await dal.updateEntry(user, entryId, patch);
    refresh();
    return res;
  },
);

export const deleteEntryAction = action({ input: z.object({ entryId: z.uuid() }), roles: ["tutor", "parent", "admin"] }, async ({ entryId }, { user }) => {
  const res = await dal.deleteEntry(user, entryId);
  refresh();
  return res;
});
