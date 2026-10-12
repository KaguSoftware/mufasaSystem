"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assetInput,
  courseInput,
  lessonInput,
  programInput,
  questionInput,
  quizInput,
  unitInput,
} from "@/lib/catalog-schemas";
import { action } from "../action";
import * as dal from "../dal/catalog";

const idInput = z.object({ id: z.uuid() });

function refresh() {
  revalidatePath("/[locale]/admin/programs", "page");
  revalidatePath("/[locale]/admin/courses", "page");
  revalidatePath("/[locale]/admin/courses/[id]", "page");
}

const admin = { roles: ["admin" as const] };
const staff = { roles: ["admin" as const, "tutor" as const] };

export const saveProgramAction = action({ input: programInput, ...admin }, async (input, { user }) => {
  const row = await dal.saveProgram(user, input);
  refresh();
  return { id: row.id };
});

export const deleteProgramAction = action({ input: idInput, ...admin }, async ({ id }, { user }) => {
  await dal.deleteProgram(user, id);
  refresh();
  return { id };
});

export const saveCourseAction = action({ input: courseInput, ...admin }, async (input, { user }) => {
  const row = await dal.saveCourse(user, input);
  refresh();
  return { id: row.id };
});

export const deleteCourseAction = action({ input: idInput, ...admin }, async ({ id }, { user }) => {
  await dal.deleteCourse(user, id);
  refresh();
  return { id };
});

export const saveUnitAction = action({ input: unitInput, ...admin }, async (input, { user }) => {
  const row = await dal.saveUnit(user, input);
  refresh();
  return { id: row.id };
});

export const deleteUnitAction = action({ input: idInput, ...admin }, async ({ id }, { user }) => {
  await dal.deleteUnit(user, id);
  refresh();
  return { id };
});

export const saveLessonAction = action({ input: lessonInput, ...staff }, async (input, { user }) => {
  const row = await dal.saveLesson(user, input);
  refresh();
  return { id: row.id };
});

export const deleteLessonAction = action({ input: idInput, ...staff }, async ({ id }, { user }) => {
  await dal.deleteLesson(user, id);
  refresh();
  return { id };
});

export const saveLessonAssetAction = action({ input: assetInput, ...staff }, async (input, { user }) => {
  const row = await dal.saveLessonAsset(user, input);
  refresh();
  return { id: row.id };
});

export const deleteLessonAssetAction = action({ input: idInput, ...staff }, async ({ id }, { user }) => {
  await dal.deleteLessonAsset(user, id);
  refresh();
  return { id };
});

export const saveQuizAction = action({ input: quizInput, ...admin }, async (input, { user }) => {
  const row = await dal.saveQuiz(user, input);
  refresh();
  return { id: row.id };
});

export const deleteQuizAction = action({ input: idInput, ...admin }, async ({ id }, { user }) => {
  await dal.deleteQuiz(user, id);
  refresh();
  return { id };
});

export const saveQuestionAction = action({ input: questionInput, ...admin }, async (input, { user }) => {
  const row = await dal.saveQuestion(user, input);
  refresh();
  return { id: row.id };
});

export const deleteQuestionAction = action({ input: idInput, ...admin }, async ({ id }, { user }) => {
  await dal.deleteQuestion(user, id);
  refresh();
  return { id };
});

const reorderInput = z.object({
  entity: z.enum(["programs", "courses", "units", "lessons", "questions", "assets"]),
  ids: z.array(z.uuid()).min(1).max(500),
});

export const reorderAction = action({ input: reorderInput, ...staff }, async ({ entity, ids }, { user }) => {
  await dal.reorder(user, entity, ids);
  refresh();
  return { ok: true };
});

const publishInput = z.object({
  entity: z.enum(["programs", "courses", "lessons"]),
  id: z.uuid(),
  published: z.boolean(),
});

export const setPublishedAction = action({ input: publishInput, ...staff }, async ({ entity, id, published }, { user }) => {
  await dal.setPublished(user, entity, id, published);
  refresh();
  return { id, published };
});
