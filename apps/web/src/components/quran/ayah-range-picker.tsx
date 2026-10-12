"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type SurahOption = { number: number; nameTranslit: string; nameAr: string; ayahCount: number };

export function SurahSelect({
  surahs,
  value,
  onChange,
  id,
  invalid,
  disabled,
}: {
  surahs: SurahOption[];
  value: number | null;
  onChange: (surah: number | null) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("hifz");
  return (
    <Select
      id={id}
      searchable
      invalid={invalid}
      disabled={disabled}
      placeholder={t("selectSurah")}
      value={value ? String(value) : null}
      onChange={(v) => onChange(v ? Number(v) : null)}
      options={surahs.map((s) => ({ value: String(s.number), label: `${s.number}. ${s.nameTranslit} (${s.nameAr})` }))}
    />
  );
}

export function AyahSelect({
  count,
  value,
  onChange,
  id,
  invalid,
  disabled,
  clearable,
  placeholder,
  min = 1,
}: {
  count: number;
  value: number | null;
  onChange: (ayah: number | null) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  min?: number;
}) {
  const t = useTranslations("hifz");
  const options = Array.from({ length: Math.max(0, count - min + 1) }, (_, i) => {
    const n = min + i;
    return { value: String(n), label: String(n) };
  });
  return (
    <Select
      id={id}
      searchable
      invalid={invalid}
      disabled={disabled || count === 0}
      clearable={clearable}
      placeholder={placeholder ?? t("selectAyah")}
      value={value ? String(value) : null}
      onChange={(v) => onChange(v ? Number(v) : null)}
      options={options}
    />
  );
}

export type RangeValue = { surah: number | null; from: number | null; to: number | null };

/** Surah (searchable) plus from/to ayah, built on the custom Select. */
export function AyahRangePicker({
  surahs,
  value,
  onChange,
  errors,
  idPrefix = "range",
  disabled,
  lockSurah,
}: {
  surahs: SurahOption[];
  value: RangeValue;
  onChange: (v: RangeValue) => void;
  errors?: { surah?: string; from?: string; to?: string };
  idPrefix?: string;
  disabled?: boolean;
  /** Keep the surah fixed (editing an existing entry) but allow changing the ayahs. */
  lockSurah?: boolean;
}) {
  const t = useTranslations("hifz");
  const count = surahs.find((s) => s.number === value.surah)?.ayahCount ?? 0;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={t("surah")} error={errors?.surah} htmlFor={`${idPrefix}-surah`} required className="sm:col-span-3">
        <SurahSelect
          id={`${idPrefix}-surah`}
          surahs={surahs}
          value={value.surah}
          invalid={Boolean(errors?.surah)}
          disabled={disabled || lockSurah}
          onChange={(surah) => onChange({ surah, from: surah ? 1 : null, to: surah ? (surahs.find((s) => s.number === surah)?.ayahCount ?? null) : null })}
        />
      </Field>
      <Field label={t("ayahFrom")} error={errors?.from} htmlFor={`${idPrefix}-from`} required>
        <AyahSelect
          id={`${idPrefix}-from`}
          count={count}
          value={value.from}
          invalid={Boolean(errors?.from)}
          disabled={disabled}
          onChange={(from) => onChange({ ...value, from, to: value.to && from && value.to < from ? from : value.to })}
        />
      </Field>
      <Field label={t("ayahTo")} error={errors?.to} htmlFor={`${idPrefix}-to`} required>
        <AyahSelect
          id={`${idPrefix}-to`}
          count={count}
          min={value.from ?? 1}
          value={value.to}
          invalid={Boolean(errors?.to)}
          disabled={disabled}
          onChange={(to) => onChange({ ...value, to })}
        />
      </Field>
    </div>
  );
}
