"use client";

import { Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAction } from "@/components/billing/use-action";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  cancelSubscriptionAction,
  extendGrantAction,
  extendSubscriptionAction,
  getUserAccessAction,
  grantAccessAction,
  revokeGrantAction,
  searchUsersAction,
} from "@/server/actions/access";
import type { UserAccessView, UserHit } from "@/server/dal/access-admin";
import type { Targets } from "./access-tabs";

const STATE_TONE: Record<string, BadgeTone> = { active: "success", expired: "neutral", revoked: "danger", scheduled: "warning" };
const endOfDay = (day: string) => new Date(`${day}T23:59:59`).toISOString();

export function GiveAccess({ targets }: { targets: Targets }) {
  const t = useTranslations("access");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useAction();

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<UserAccessView | null>(null);

  const [grantOpen, setGrantOpen] = useState(false);
  const [extending, setExtending] = useState<{ id: string } | null>(null);
  const [extendSub, setExtendSub] = useState<{ id: string } | null>(null);

  // Debounced async search via server action.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchUsersAction({ query: q });
      if (!cancelled && res.ok) setHits(res.data);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function load(id: string) {
    const res = await run(() => getUserAccessAction({ userId: id }), { refresh: false });
    if (res.ok) setView(res.data);
  }

  async function reload() {
    if (userId) await load(userId);
  }

  function pick(id: string | null) {
    setUserId(id);
    setView(null);
    if (id) void load(id);
  }

  const shown = query.trim().length < 2 ? [] : hits;
  const options = shown.map((h) => ({
    value: h.id,
    label: h.name,
    description: [h.email, h.username ? `@${h.username}` : null].filter(Boolean).join(" · "),
    group: undefined,
  }));
  // Keep the selected user visible even after the query changes.
  if (view && !options.some((o) => o.value === view.user.id)) {
    options.unshift({ value: view.user.id, label: view.user.name, description: view.user.email, group: undefined });
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("searchUser")} hint={query.trim().length < 2 ? t("typeToSearch") : undefined}>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-9" />
            </div>
          </Field>
          <Field label=" ">
            <Select searchable options={options} value={userId} onChange={pick} placeholder={t("searchUser")} />
          </Field>
        </CardBody>
      </Card>

      {view && (
        <>
          <Card>
            <CardHeader
              title={view.user.name}
              description={`${view.user.email} · ${view.user.role}`}
              actions={
                <Button onClick={() => setGrantOpen(true)}>
                  <Plus className="size-4" />
                  {t("grantAccess")}
                </Button>
              }
            />
            <CardBody className="flex items-center gap-3 text-sm">
              <span className="font-medium">{t("currentAccess")}</span>
              <Badge tone={view.status.active ? "success" : "neutral"}>{view.status.active ? t("statusActive") : t("statusNone")}</Badge>
              {view.status.active && (
                <span className="text-muted">{view.status.forever ? t("forever") : view.status.until ? t("until", { date: fmtDate(view.status.until) }) : ""}</span>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("grantsTitle")} />
            {view.grants.length === 0 ? (
              <CardBody className="text-sm text-muted">{t("noGrants")}</CardBody>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>{t("scope")}</Th>
                    <Th>{t("expires")}</Th>
                    <Th>{t("reason")}</Th>
                    <Th>{tc("status")}</Th>
                    <Th />
                  </Tr>
                </THead>
                <TBody>
                  {view.grants.map((g) => (
                    <Tr key={g.id}>
                      <Td>
                        {t(`scopes.${g.scope}`)}
                        {g.targetName && <p className="text-xs text-muted">{g.targetName}</p>}
                      </Td>
                      <Td>
                        {g.expiresAt ? fmtDate(g.expiresAt) : t("noExpiry")}
                        {g.state === "scheduled" && <p className="text-xs text-muted">{t("startsOn", { date: fmtDate(g.startsAt) })}</p>}
                      </Td>
                      <Td className="max-w-56 truncate text-muted">{g.reason}</Td>
                      <Td>
                        <Badge tone={STATE_TONE[g.state]}>{t(`state.${g.state}`)}</Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-end">
                        {g.state !== "revoked" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setExtending({ id: g.id })}>
                              {t("extend")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ms-2"
                              onClick={async () => {
                                if (!window.confirm(t("revokeConfirm"))) return;
                                const res = await run(() => revokeGrantAction({ grantId: g.id }), { success: t("revoked") });
                                if (res.ok) await reload();
                              }}
                            >
                              {t("revoke")}
                            </Button>
                          </>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title={t("subsTitle")} />
            {view.subscriptions.length === 0 ? (
              <CardBody className="text-sm text-muted">{t("noSubs")}</CardBody>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>{t("colPlan")}</Th>
                    <Th>{t("expires")}</Th>
                    <Th>{tc("status")}</Th>
                    <Th />
                  </Tr>
                </THead>
                <TBody>
                  {view.subscriptions.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        {s.planName}
                        <p className="text-xs text-muted">{t("payer", { name: s.payerName })}</p>
                      </Td>
                      <Td>{s.periodEnd ? fmtDate(s.periodEnd) : tc("none")}</Td>
                      <Td>
                        <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-end">
                        {s.source === "manual" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setExtendSub({ id: s.id })}>
                              {t("extend")}
                            </Button>
                            {(s.status === "active" || s.status === "past_due") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="ms-2"
                                onClick={async () => {
                                  if (!window.confirm(t("cancelConfirm"))) return;
                                  const res = await run(() => cancelSubscriptionAction({ subscriptionId: s.id }), {
                                    success: t("subCancelled"),
                                  });
                                  if (res.ok) await reload();
                                }}
                              >
                                {t("cancelSubscription")}
                              </Button>
                            )}
                          </>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <GrantDialog
            open={grantOpen}
            onOpenChange={setGrantOpen}
            user={view.user}
            targets={targets}
            onDone={reload}
          />
          <ExtendGrantDialog target={extending} onClose={() => setExtending(null)} onDone={reload} />
          <ExtendSubDialog target={extendSub} onClose={() => setExtendSub(null)} onDone={reload} />
        </>
      )}
    </div>
  );
}

function GrantDialog({
  open,
  onOpenChange,
  user,
  targets,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: UserHit;
  targets: Targets;
  onDone: () => Promise<void>;
}) {
  const t = useTranslations("access");
  const tc = useTranslations("common");
  const run = useAction();
  const [scope, setScope] = useState<"all" | "program" | "course">("all");
  const [programId, setProgramId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [noExpiry, setNoExpiry] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const valid =
    reason.trim().length >= 2 &&
    (noExpiry || Boolean(day)) &&
    (scope === "all" || (scope === "program" && programId) || (scope === "course" && courseId));

  async function submit() {
    setBusy(true);
    try {
      const res = await run(
        () =>
          grantAccessAction({
            userId: user.id,
            scope,
            programId: scope === "program" ? programId : null,
            courseId: scope === "course" ? courseId : null,
            expiresAt: noExpiry || !day ? null : endOfDay(day),
            reason: reason.trim(),
          }),
        { success: t("granted") },
      );
      if (res.ok) {
        onOpenChange(false);
        setReason("");
        await onDone();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("grantTitle")} description={t("grantDescription", { name: user.name })}>
        <div className="flex flex-col gap-4">
          <Field label={t("scope")}>
            <Select
              options={(["all", "program", "course"] as const).map((s) => ({ value: s, label: t(`scopes.${s}`) }))}
              value={scope}
              onChange={(v) => v && setScope(v as typeof scope)}
            />
          </Field>
          {scope === "program" && (
            <Field label={t("program")} required>
              <Select searchable options={targets.programs.map((p) => ({ value: p.id, label: p.name }))} value={programId} onChange={setProgramId} />
            </Field>
          )}
          {scope === "course" && (
            <Field label={t("course")} required>
              <Select searchable options={targets.courses.map((c) => ({ value: c.id, label: c.name }))} value={courseId} onChange={setCourseId} />
            </Field>
          )}
          <Field label={t("expires")}>
            <div className="flex flex-col gap-2">
              <DatePicker value={day} onChange={setDay} min={new Date()} disabled={noExpiry} placeholder={t("setExpiry")} />
              <Switch checked={noExpiry} onCheckedChange={setNoExpiry} label={t("noExpiry")} />
            </div>
          </Field>
          <Field label={t("reason")} required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{tc("cancel")}</Button>
            </DialogClose>
            <Button onClick={submit} loading={busy} disabled={!valid}>
              {t("grantAccess")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtendGrantDialog({
  target,
  onClose,
  onDone,
}: {
  target: { id: string } | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const t = useTranslations("access");
  const tc = useTranslations("common");
  const run = useAction();
  const [day, setDay] = useState<string | null>(null);
  const [noExpiry, setNoExpiry] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await run(
        () => extendGrantAction({ grantId: target.id, expiresAt: noExpiry || !day ? null : endOfDay(day) }),
        { success: t("extended") },
      );
      if (res.ok) {
        onClose();
        await onDone();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("extendTitle")} size="sm">
        <div className="flex flex-col gap-4">
          <Field label={t("newExpiry")}>
            <div className="flex flex-col gap-2">
              <DatePicker value={day} onChange={setDay} min={new Date()} disabled={noExpiry} />
              <Switch checked={noExpiry} onCheckedChange={setNoExpiry} label={t("noExpiry")} />
            </div>
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{tc("cancel")}</Button>
            </DialogClose>
            <Button onClick={submit} loading={busy} disabled={!noExpiry && !day}>
              {t("extend")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtendSubDialog({
  target,
  onClose,
  onDone,
}: {
  target: { id: string } | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const t = useTranslations("access");
  const tc = useTranslations("common");
  const run = useAction();
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await run(() => extendSubscriptionAction({ subscriptionId: target.id, days: Number(days) }), {
        success: t("subExtended"),
      });
      if (res.ok) {
        onClose();
        await onDone();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("extendDays")} size="sm">
        <div className="flex flex-col gap-4">
          <Field label={t("days")}>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{tc("cancel")}</Button>
            </DialogClose>
            <Button onClick={submit} loading={busy} disabled={!(Number(days) >= 1)}>
              {t("extend")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
