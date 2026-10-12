import "server-only";
import { z } from "zod";
import { getDb, isDbConfigured, schema } from "@mufasa/db";
import { brand } from "@mufasa/config/brand";
import type { I18nText } from "@mufasa/config/locales";
import { audit } from "../audit";
import { forbidden } from "../errors";
import type { SessionUser } from "../session";

const i18nText = z.object({ en: z.string().max(2000), ar: z.string().max(2000).optional(), tr: z.string().max(2000).optional() });

/** Typed settings registry: key -> zod schema + default. Add new keys here. */
export const SETTING_DEFS = {
  "payment.iban": { schema: z.string().trim().max(64), default: "" },
  "payment.accountName": { schema: z.string().trim().max(120), default: "" },
  "payment.bankName": { schema: z.string().trim().max(120), default: "" },
  "payment.instructions": { schema: i18nText, default: { en: "" } as I18nText },
  /** Digits only (E.164 without +). Empty falls back to brand.whatsappNumber. */
  "contact.whatsapp": { schema: z.string().trim().regex(/^\d{7,15}$/).or(z.literal("")), default: "" },
  "contact.email": { schema: z.string().trim().email().or(z.literal("")), default: "" },
  "billing.reminderDaysBefore": { schema: z.number().int().min(1).max(30), default: 3 },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTING_DEFS)[K]["schema"]>;

export type AllSettings = { [K in SettingKey]: SettingValue<K> };

export function defaultSettings(): AllSettings {
  return Object.fromEntries(Object.entries(SETTING_DEFS).map(([k, d]) => [k, d.default])) as AllSettings;
}

/** Merge raw rows over defaults, falling back per key when a stored value no longer validates. */
export function resolveSettings(rows: { key: string; value: unknown }[]): AllSettings {
  const out = defaultSettings() as Record<string, unknown>;
  for (const row of rows) {
    const def = SETTING_DEFS[row.key as SettingKey];
    if (!def) continue;
    const parsed = def.schema.safeParse(row.value);
    if (parsed.success) out[row.key] = parsed.data;
  }
  const s = out as AllSettings;
  if (!s["contact.whatsapp"]) s["contact.whatsapp"] = brand.whatsappNumber;
  if (!s["contact.email"]) s["contact.email"] = brand.supportEmail;
  return s;
}

export async function getSettings(): Promise<AllSettings> {
  if (!isDbConfigured()) return resolveSettings([]);
  const rows = await getDb().select({ key: schema.settings.key, value: schema.settings.value }).from(schema.settings);
  return resolveSettings(rows);
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  return (await getSettings())[key] as SettingValue<K>;
}

export type PublicSettings = Pick<
  AllSettings,
  "payment.iban" | "payment.accountName" | "payment.bankName" | "payment.instructions" | "contact.whatsapp" | "contact.email"
>;

/** Safe subset shown to signed-in families (bank details are meant to be shared). Works without a DB. */
export async function getPublicSettings(): Promise<PublicSettings> {
  let s: AllSettings;
  try {
    s = await getSettings();
  } catch {
    s = resolveSettings([]);
  }
  return {
    "payment.iban": s["payment.iban"],
    "payment.accountName": s["payment.accountName"],
    "payment.bankName": s["payment.bankName"],
    "payment.instructions": s["payment.instructions"],
    "contact.whatsapp": s["contact.whatsapp"],
    "contact.email": s["contact.email"],
  };
}

export const settingsPatchSchema = z.object({
  "payment.iban": SETTING_DEFS["payment.iban"].schema.optional(),
  "payment.accountName": SETTING_DEFS["payment.accountName"].schema.optional(),
  "payment.bankName": SETTING_DEFS["payment.bankName"].schema.optional(),
  "payment.instructions": SETTING_DEFS["payment.instructions"].schema.optional(),
  "contact.whatsapp": SETTING_DEFS["contact.whatsapp"].schema.optional(),
  "contact.email": SETTING_DEFS["contact.email"].schema.optional(),
  "billing.reminderDaysBefore": SETTING_DEFS["billing.reminderDaysBefore"].schema.optional(),
});
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export async function updateSettings(actor: SessionUser, patch: SettingsPatch) {
  if (actor.role !== "admin") throw forbidden();
  const before = await getSettings();
  const entries = Object.entries(settingsPatchSchema.parse(patch)).filter(([, v]) => v !== undefined);
  if (!entries.length) return before;
  const db = getDb();
  for (const [key, value] of entries) {
    await db
      .insert(schema.settings)
      .values({ key, value, updatedBy: actor.id })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedBy: actor.id } });
  }
  await audit({
    actorId: actor.id,
    action: "settings.update",
    entity: "settings",
    before: Object.fromEntries(entries.map(([k]) => [k, before[k as SettingKey]])),
    after: Object.fromEntries(entries),
  });
  return getSettings();
}
