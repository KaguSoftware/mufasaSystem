"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n, type I18nText } from "@mufasa/config/locales";
import { useAction } from "@/components/billing/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, Switch, TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatMoney } from "@/lib/billing-math";
import { deleteCouponAction, saveCouponAction, savePlanAction } from "@/server/actions/billing";

type Currency = "TRY" | "USD" | "EUR";
type Interval = "month" | "quarter" | "year" | "one_time";

export type PlanRow = {
  id: string;
  slug: string;
  name: I18nText;
  description: I18nText | null;
  priceMinor: number;
  currency: Currency;
  interval: Interval;
  periodDays: number;
  programIds: string[];
  seats: number;
  features: string[];
  iyzicoPricingPlanRef: string | null;
  active: boolean;
  sortOrder: number;
};

export type CouponRow = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffMinor: number | null;
  currency: Currency | null;
  maxRedemptions: number | null;
  redemptions: number;
  planIds: string[];
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
};

const currencies: Currency[] = ["TRY", "USD", "EUR"];
const intervals: Interval[] = ["month", "quarter", "year", "one_time"];

export function PlansManager({
  plans,
  coupons,
  programs,
}: {
  plans: PlanRow[];
  coupons: CouponRow[];
  programs: { id: string; name: string }[];
}) {
  const t = useTranslations("billing.admin");
  return (
    <TabsRoot defaultValue="plans">
      <TabsList>
        <TabsTrigger value="plans">{t("tabPlans")}</TabsTrigger>
        <TabsTrigger value="coupons">{t("tabCoupons")}</TabsTrigger>
      </TabsList>
      <TabsContent value="plans">
        <PlansTab plans={plans} programs={programs} />
      </TabsContent>
      <TabsContent value="coupons">
        <CouponsTab coupons={coupons} plans={plans} />
      </TabsContent>
    </TabsRoot>
  );
}

// ───────────────────────────── Plans ─────────────────────────────

type PlanForm = {
  id?: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  nameTr: string;
  descEn: string;
  descAr: string;
  descTr: string;
  price: string;
  currency: Currency;
  interval: Interval;
  periodDays: string;
  seats: string;
  programIds: string[];
  features: string;
  iyzicoRef: string;
  active: boolean;
  sortOrder: string;
};

const blankPlan = (): PlanForm => ({
  slug: "",
  nameEn: "",
  nameAr: "",
  nameTr: "",
  descEn: "",
  descAr: "",
  descTr: "",
  price: "",
  currency: "TRY",
  interval: "month",
  periodDays: "30",
  seats: "1",
  programIds: [],
  features: "",
  iyzicoRef: "",
  active: true,
  sortOrder: "0",
});

const fromPlan = (p: PlanRow): PlanForm => ({
  id: p.id,
  slug: p.slug,
  nameEn: p.name.en,
  nameAr: p.name.ar ?? "",
  nameTr: p.name.tr ?? "",
  descEn: p.description?.en ?? "",
  descAr: p.description?.ar ?? "",
  descTr: p.description?.tr ?? "",
  price: String(p.priceMinor / 100),
  currency: p.currency,
  interval: p.interval,
  periodDays: String(p.periodDays),
  seats: String(p.seats),
  programIds: p.programIds,
  features: p.features.join("\n"),
  iyzicoRef: p.iyzicoPricingPlanRef ?? "",
  active: p.active,
  sortOrder: String(p.sortOrder),
});

const toMinor = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100);
const opt = (v: string) => v.trim() || undefined;

function PlansTab({ plans, programs }: { plans: PlanRow[]; programs: { id: string; name: string }[] }) {
  const t = useTranslations("billing.admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useAction();
  const [form, setForm] = useState<PlanForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const res = await run(
        () =>
          savePlanAction({
            id: form.id,
            slug: form.slug,
            name: { en: form.nameEn, ar: opt(form.nameAr), tr: opt(form.nameTr) },
            description: form.descEn.trim() ? { en: form.descEn, ar: opt(form.descAr), tr: opt(form.descTr) } : null,
            priceMinor: toMinor(form.price),
            currency: form.currency,
            interval: form.interval,
            periodDays: Number(form.periodDays),
            programIds: form.programIds,
            seats: Number(form.seats),
            liveClassesPerMonth: 0,
            features: form.features
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            iyzicoPricingPlanRef: opt(form.iyzicoRef) ?? null,
            active: form.active,
            sortOrder: Number(form.sortOrder) || 0,
          }),
        { success: t("saved") },
      );
      if (res.ok) {
        setForm(null);
        setErrors({});
      } else setErrors(res.error.fieldErrors ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setForm(blankPlan())}>
          <Plus className="size-4" />
          {t("newPlan")}
        </Button>
      </div>
      {plans.length === 0 ? (
        <EmptyState title={t("noPlans")} />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>{tc("name")}</Th>
                <Th>{t("price")}</Th>
                <Th>{t("interval")}</Th>
                <Th>{t("seats")}</Th>
                <Th>{tc("status")}</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {plans.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <p className="font-medium">{t18n(p.name, locale)}</p>
                    <p className="font-mono text-xs text-muted" dir="ltr">
                      {p.slug}
                    </p>
                  </Td>
                  <Td className="tabular-nums">{formatMoney(p.priceMinor, p.currency, locale)}</Td>
                  <Td>
                    {t(`intervals.${p.interval}`)} · {p.periodDays}
                  </Td>
                  <Td>{p.seats}</Td>
                  <Td>
                    <Badge tone={p.active ? "success" : "neutral"}>{p.active ? t("active") : t("inactive")}</Badge>
                  </Td>
                  <Td className="text-end">
                    <Button variant="ghost" size="icon" aria-label={tc("edit")} onClick={() => setForm(fromPlan(p))}>
                      <Pencil className="size-4" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Dialog open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent title={form?.id ? t("editPlan") : t("newPlan")} size="lg">
          {form && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("slug")} required error={errors.slug?.[0] === "taken" ? t("slugTaken") : errors.slug}>
                  <Input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} dir="ltr" aria-invalid={Boolean(errors.slug) || undefined} />
                </Field>
                <Field label={t("sortOrder")}>
                  <Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("nameEn")} required error={errors["name.en"]}>
                  <Input value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
                </Field>
                <Field label={t("nameAr")}>
                  <Input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" />
                </Field>
                <Field label={t("nameTr")}>
                  <Input value={form.nameTr} onChange={(e) => set("nameTr", e.target.value)} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={`${tc("optional")} EN`}>
                  <Textarea value={form.descEn} onChange={(e) => set("descEn", e.target.value)} className="min-h-16" />
                </Field>
                <Field label={`${tc("optional")} AR`}>
                  <Textarea value={form.descAr} onChange={(e) => set("descAr", e.target.value)} dir="rtl" className="min-h-16" />
                </Field>
                <Field label={`${tc("optional")} TR`}>
                  <Textarea value={form.descTr} onChange={(e) => set("descTr", e.target.value)} className="min-h-16" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("price")} hint={t("priceHint")} required error={errors.priceMinor}>
                  <Input inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} dir="ltr" />
                </Field>
                <Field label={t("currency")}>
                  <Select options={currencies.map((c) => ({ value: c, label: c }))} value={form.currency} onChange={(v) => v && set("currency", v as Currency)} />
                </Field>
                <Field label={t("interval")}>
                  <Select
                    options={intervals.map((i) => ({ value: i, label: t(`intervals.${i}`) }))}
                    value={form.interval}
                    onChange={(v) => v && set("interval", v as Interval)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("periodDays")} required error={errors.periodDays}>
                  <Input type="number" min={1} value={form.periodDays} onChange={(e) => set("periodDays", e.target.value)} />
                </Field>
                <Field label={t("seats")} required error={errors.seats}>
                  <Input type="number" min={1} max={20} value={form.seats} onChange={(e) => set("seats", e.target.value)} />
                </Field>
              </div>
              <Field label={t("programs")}>
                <Select
                  multiple
                  options={programs.map((p) => ({ value: p.id, label: p.name }))}
                  value={form.programIds}
                  onChange={(v) => set("programIds", v)}
                  placeholder={t("allPrograms")}
                  emptyText={t("allPrograms")}
                />
              </Field>
              <Field label={t("featuresList")}>
                <Textarea value={form.features} onChange={(e) => set("features", e.target.value)} />
              </Field>
              <Field label={t("iyzicoRef")} hint={t("iyzicoHint")}>
                <Input value={form.iyzicoRef} onChange={(e) => set("iyzicoRef", e.target.value)} dir="ltr" />
              </Field>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} label={t("active")} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{tc("cancel")}</Button>
                </DialogClose>
                <Button onClick={save} loading={busy}>
                  {tc("save")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ───────────────────────────── Coupons ─────────────────────────────

type CouponForm = {
  id?: string;
  code: string;
  kind: "percent" | "amount";
  percent: string;
  amount: string;
  currency: Currency;
  maxRedemptions: string;
  planIds: string[];
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
};

const blankCoupon = (): CouponForm => ({
  code: "",
  kind: "percent",
  percent: "10",
  amount: "",
  currency: "TRY",
  maxRedemptions: "",
  planIds: [],
  validFrom: null,
  validUntil: null,
  active: true,
});

const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

function CouponsTab({ coupons, plans }: { coupons: CouponRow[]; plans: PlanRow[] }) {
  const t = useTranslations("billing.admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useAction();
  const [form, setForm] = useState<CouponForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const edit = (c: CouponRow): CouponForm => ({
    id: c.id,
    code: c.code,
    kind: c.percentOff ? "percent" : "amount",
    percent: String(c.percentOff ?? ""),
    amount: c.amountOffMinor ? String(c.amountOffMinor / 100) : "",
    currency: c.currency ?? "TRY",
    maxRedemptions: c.maxRedemptions ? String(c.maxRedemptions) : "",
    planIds: c.planIds,
    validFrom: dayOf(c.validFrom),
    validUntil: dayOf(c.validUntil),
    active: c.active,
  });

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const res = await run(
        () =>
          saveCouponAction({
            id: form.id,
            code: form.code,
            percentOff: form.kind === "percent" ? Number(form.percent) || null : null,
            amountOffMinor: form.kind === "amount" ? toMinor(form.amount) || null : null,
            currency: form.kind === "amount" ? form.currency : null,
            maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
            planIds: form.planIds,
            validFrom: form.validFrom ? new Date(`${form.validFrom}T00:00:00`).toISOString() : null,
            validUntil: form.validUntil ? new Date(`${form.validUntil}T23:59:59`).toISOString() : null,
            active: form.active,
          }),
        { success: t("saved") },
      );
      if (res.ok) {
        setForm(null);
        setErrors({});
      } else setErrors(res.error.fieldErrors ?? {});
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: CouponRow) {
    if (!window.confirm(t("confirmDeleteCoupon"))) return;
    await run(() => deleteCouponAction({ id: c.id }), { success: tc("delete") });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setForm(blankCoupon())}>
          <Plus className="size-4" />
          {t("newCoupon")}
        </Button>
      </div>
      {coupons.length === 0 ? (
        <EmptyState title={t("noCoupons")} />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>{t("code")}</Th>
                <Th>{t("discountKind")}</Th>
                <Th>{t("redemptions")}</Th>
                <Th>{t("validUntil")}</Th>
                <Th>{tc("status")}</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {coupons.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-mono font-medium" dir="ltr">
                    {c.code}
                  </Td>
                  <Td className="tabular-nums">
                    {c.percentOff ? `${c.percentOff}%` : formatMoney(c.amountOffMinor ?? 0, c.currency ?? "TRY", locale)}
                  </Td>
                  <Td className="tabular-nums">
                    {c.redemptions}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                  </Td>
                  <Td>{c.validUntil ? new Date(c.validUntil).toLocaleDateString(locale) : tc("none")}</Td>
                  <Td>
                    <Badge tone={c.active ? "success" : "neutral"}>{c.active ? t("active") : t("inactive")}</Badge>
                  </Td>
                  <Td className="text-end">
                    <Button variant="ghost" size="icon" aria-label={tc("edit")} onClick={() => setForm(edit(c))}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={tc("delete")} onClick={() => remove(c)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Dialog open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent title={form?.id ? t("editCoupon") : t("newCoupon")}>
          {form && (
            <div className="flex flex-col gap-4">
              <Field label={t("code")} required error={errors.code?.[0] === "taken" ? t("slugTaken") : errors.code}>
                <Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} dir="ltr" className="font-mono" />
              </Field>
              <Field label={t("discountKind")}>
                <RadioGroup
                  value={form.kind}
                  onValueChange={(v) => set("kind", v as "percent" | "amount")}
                  options={[
                    { value: "percent", label: t("percent") },
                    { value: "amount", label: t("amount") },
                  ]}
                />
              </Field>
              {form.kind === "percent" ? (
                <Field label={t("percentOff")} error={errors.percentOff}>
                  <Input type="number" min={1} max={100} value={form.percent} onChange={(e) => set("percent", e.target.value)} />
                </Field>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("amountOff")} error={errors.amountOffMinor}>
                    <Input inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} dir="ltr" />
                  </Field>
                  <Field label={t("currency")}>
                    <Select
                      options={currencies.map((c) => ({ value: c, label: c }))}
                      value={form.currency}
                      onChange={(v) => v && set("currency", v as Currency)}
                    />
                  </Field>
                </div>
              )}
              <Field label={t("maxRedemptions")} hint={tc("optional")}>
                <Input type="number" min={1} value={form.maxRedemptions} onChange={(e) => set("maxRedemptions", e.target.value)} />
              </Field>
              <Field label={t("appliesTo")}>
                <Select
                  multiple
                  options={plans.map((p) => ({ value: p.id, label: t18n(p.name, locale) }))}
                  value={form.planIds}
                  onChange={(v) => set("planIds", v)}
                  placeholder={t("allPlans")}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("validFrom")}>
                  <DatePicker value={form.validFrom} onChange={(v) => set("validFrom", v)} />
                </Field>
                <Field label={t("validUntil")}>
                  <DatePicker value={form.validUntil} onChange={(v) => set("validUntil", v)} />
                </Field>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} label={t("active")} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{tc("cancel")}</Button>
                </DialogClose>
                <Button onClick={save} loading={busy}>
                  {tc("save")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
