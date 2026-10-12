"use server";

import { action } from "../action";
import { settingsPatchSchema, updateSettings } from "../dal/settings";

export const updateSettingsAction = action({ input: settingsPatchSchema, roles: ["admin"] }, async (input, { user }) =>
  updateSettings(user, input),
);
