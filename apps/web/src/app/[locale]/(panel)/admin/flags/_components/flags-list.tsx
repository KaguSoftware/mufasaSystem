"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Role } from "@mufasa/db/schema";
import { useRouter } from "@/i18n/navigation";
import { upsertFlag } from "@/server/actions/flags";
import { useErrorText } from "@/components/account/use-action-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type Flag = {
  key: string;
  description: string;
  enabled: boolean;
  roles: string[];
  percentage: number;
  persisted: boolean;
};

const ROLE_LIST: readonly Role[] = ["admin", "tutor", "parent", "student"];

export function FlagsList({ flags }: { flags: Flag[] }) {
  return (
    <div className="flex flex-col gap-3">
      {flags.map((f) => (
        <FlagRow key={f.key} flag={f} />
      ))}
    </div>
  );
}

function FlagRow({ flag }: { flag: Flag }) {
  const t = useTranslations("admin");
  const tr = useTranslations("roles");
  const errText = useErrorText();
  const router = useRouter();
  const [enabled, setEnabled] = useState(flag.enabled);
  const [roles, setRoles] = useState<string[]>(flag.roles);
  const [percentage, setPercentage] = useState(String(flag.percentage));
  const [busy, setBusy] = useState(false);

  const pct = Number(percentage);
  const pctValid = Number.isInteger(pct) && pct >= 0 && pct <= 100;
  const dirty =
    enabled !== flag.enabled ||
    percentage !== String(flag.percentage) ||
    roles.slice().sort().join() !== flag.roles.slice().sort().join();

  async function save(next?: { enabled: boolean }) {
    if (!pctValid) return;
    setBusy(true);
    const res = await upsertFlag({
      key: flag.key,
      enabled: next?.enabled ?? enabled,
      roles: roles as Role[],
      percentage: pct,
    });
    setBusy(false);
    if (!res.ok) {
      setEnabled(flag.enabled);
      return toast.error(errText(res.error));
    }
    toast.success(t("flagSaved"));
    router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-semibold">{flag.key}</code>
            {!flag.persisted && <Badge>{t("flagDefault")}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">{flag.description}</p>
        </div>
        <Switch
          checked={enabled}
          disabled={busy}
          aria-label={flag.key}
          onCheckedChange={(c) => {
            setEnabled(c);
            void save({ enabled: c });
          }}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <Field label={t("flagRoles")} hint={t("flagRolesHint")}>
          <Select
            multiple
            options={ROLE_LIST.map((r) => ({ value: r, label: tr(r) }))}
            value={roles}
            onChange={setRoles}
            placeholder={t("flagAllRoles")}
            searchable={false}
          />
        </Field>
        <Field label={t("flagPercentage")} error={pctValid ? undefined : t("flagPercentageInvalid")}>
          <Input inputMode="numeric" maxLength={3} value={percentage} onChange={(e) => setPercentage(e.target.value.replace(/\D/g, ""))} aria-invalid={!pctValid} />
        </Field>
        <Button onClick={() => save()} loading={busy} disabled={!dirty || !pctValid}>
          {t("save")}
        </Button>
      </div>
    </Card>
  );
}
