import { jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import type { I18nText } from "@mufasa/config/locales";

export const id = () => uuid().primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Translatable text column: { en, ar?, tr? } */
export const i18n = () => jsonb().$type<I18nText>();

export type { I18nText };
