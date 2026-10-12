"use client";

import { useTranslations } from "next-intl";
import { Field, Input, Textarea } from "@/components/ui/input";

export type I18nValue = { en: string; ar: string; tr: string };

export const emptyI18n = (): I18nValue => ({ en: "", ar: "", tr: "" });

/** Converts a stored I18nText (or null) into the always-complete editing shape. */
export function toI18nValue(v: { en: string; ar?: string; tr?: string } | null | undefined): I18nValue {
  return { en: v?.en ?? "", ar: v?.ar ?? "", tr: v?.tr ?? "" };
}

/** Three inputs (English, Arabic, Turkish) for one translatable value. */
export function I18nFields({
  label,
  value,
  onChange,
  multiline,
  required,
  error,
}: {
  label: string;
  value: I18nValue;
  onChange: (v: I18nValue) => void;
  multiline?: boolean;
  required?: boolean;
  error?: string | string[];
}) {
  const t = useTranslations("catalog");
  const langs = [
    { key: "en", label: t("langEn") },
    { key: "ar", label: t("langAr") },
    { key: "tr", label: t("langTr") },
  ] as const;
  return (
    <Field label={label} required={required} error={error}>
      <div className="grid gap-2">
        {langs.map((l) => {
          const common = {
            value: value[l.key],
            placeholder: l.label,
            "aria-label": `${label} (${l.label})`,
            dir: l.key === "ar" ? ("rtl" as const) : undefined,
            "aria-invalid": l.key === "en" && error ? true : undefined,
          };
          return multiline ? (
            <Textarea key={l.key} {...common} onChange={(e) => onChange({ ...value, [l.key]: e.target.value })} />
          ) : (
            <Input key={l.key} {...common} onChange={(e) => onChange({ ...value, [l.key]: e.target.value })} />
          );
        })}
      </div>
    </Field>
  );
}
