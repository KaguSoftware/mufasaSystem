"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as dal from "../dal/studio";
import * as studio from "../services/ai-studio";
import { isStudioVoice } from "@/lib/ai-studio";

const roles = ["tutor", "admin"] as const;
const flag = "ai_studio" as const;
const id = z.object({ id: z.string().uuid() });

function refresh() {
  revalidatePath("/[locale]/tutor/studio", "layout");
  revalidatePath("/[locale]/admin/studio", "layout");
}

export const createConversation = action(
  { input: dal.createConversationSchema, roles: [...roles], flag },
  async (input, { user }) => {
    const row = await dal.createConversation(user, input);
    refresh();
    return row;
  },
);

export const updateConversation = action(
  { input: dal.updateConversationSchema, roles: [...roles], flag },
  async (input, { user }) => {
    await dal.updateConversation(user, input);
    refresh();
    return { ok: true as const };
  },
);

export const deleteConversation = action({ input: id, roles: [...roles], flag }, async ({ id: convId }, { user }) => {
  await dal.deleteConversation(user, convId);
  refresh();
  return { ok: true as const };
});

export const saveScript = action({ input: dal.saveScriptSchema, roles: [...roles], flag }, async (input, { user }) => {
  const row = await dal.saveScript(user, input);
  refresh();
  return row;
});

export const updateScript = action({ input: dal.updateScriptSchema, roles: [...roles], flag }, async (input, { user }) => {
  await dal.updateScript(user, input);
  refresh();
  return { ok: true as const };
});

export const approveScript = action({ input: id, roles: [...roles], flag }, async ({ id: scriptId }, { user }) => {
  await dal.approveScript(user, scriptId);
  refresh();
  return { ok: true as const };
});

export const generateScenes = action(
  { input: z.object({ scriptId: z.string().uuid(), projectId: z.string().uuid().optional() }), roles: [...roles], flag, rateLimit: "ai.scenes" },
  async ({ scriptId, projectId }, { user }) => {
    const res = await studio.generateScenes(user, scriptId, projectId);
    refresh();
    return res;
  },
);

export const updateProjectScenes = action({ input: dal.updateScenesSchema, roles: [...roles], flag }, async (input, { user }) => {
  const res = await dal.updateProjectScenes(user, input);
  refresh();
  return res;
});

export const voiceProject = action(
  {
    input: z.object({ projectId: z.string().uuid(), voice: z.string().refine(isStudioVoice).optional() }),
    roles: [...roles],
    flag,
    rateLimit: "ai.tts",
  },
  async ({ projectId, voice }, { user }) => studio.voiceProject(user, projectId, voice),
);

export const renderProject = action(
  { input: z.object({ projectId: z.string().uuid(), allowSilent: z.boolean().optional() }), roles: [...roles], flag },
  async ({ projectId, allowSilent }, { user }) => studio.renderProject(user, projectId, { allowSilent }),
);

export const publishProject = action(
  { input: z.object({ projectId: z.string().uuid() }), roles: [...roles], flag },
  async ({ projectId }, { user }) => {
    const res = await studio.publishProject(user, projectId);
    refresh();
    return res;
  },
);

export const getProjectStatus = action(
  { input: z.object({ projectId: z.string().uuid() }), roles: [...roles], flag },
  async ({ projectId }, { user }) => dal.getProjectStatus(user, projectId),
);
