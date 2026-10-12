"use client";

import { ChevronDown, ScrollText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";

type Row = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export function AuditTable({
  rows,
  entities,
  entity,
  action,
  page,
  total,
  pageSize,
}: {
  rows: Row[];
  entities: string[];
  entity: string | null;
  action: string;
  page: number;
  total: number;
  pageSize: number;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(action);
  const [open, setOpen] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function go(params: { entity?: string | null; action?: string | null; page?: number | null }) {
    const next = { entity, action: action || null, ...params };
    const sp = new URLSearchParams();
    if (next.entity) sp.set("entity", next.entity);
    if (next.action) sp.set("action", next.action);
    if (params.page && params.page > 1) sp.set("page", String(params.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <Select
            clearable
            options={entities.map((e) => ({ value: e, label: e }))}
            value={entity}
            onChange={(v) => go({ entity: v })}
            placeholder={t("allEntities")}
          />
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ action: search.trim() || null });
          }}
        >
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("filterAction")} className="w-56" />
          <Button type="submit" variant="outline">
            {t("search")}
          </Button>
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState className="border-0" icon={<ScrollText className="size-8" />} title={t("noAudit")} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th className="w-10" />
                <Th>{t("colWhen")}</Th>
                <Th>{t("colActor")}</Th>
                <Th>{t("colAction")}</Th>
                <Th>{t("colEntity")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const isOpen = open === r.id;
                const hasDetail = r.before != null || r.after != null;
                return (
                  <Fragment key={r.id}>
                    <Tr>
                      <Td>
                        {hasDetail && (
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : r.id)}
                            className="rounded-sm p-1 text-muted hover:bg-surface-2"
                            aria-expanded={isOpen}
                            aria-label={t("details")}
                          >
                            <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                          </button>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString(locale)}</Td>
                      <Td>{r.actorName ?? t("system")}</Td>
                      <Td>
                        <code className="text-xs">{r.action}</code>
                      </Td>
                      <Td>
                        {r.entity}
                        {r.entityId && <span className="ms-1 text-xs text-muted">{r.entityId.slice(0, 8)}</span>}
                      </Td>
                    </Tr>
                    {isOpen && (
                      <tr className="bg-surface-2/40">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <JsonBlock label={t("before")} value={r.before} />
                            <JsonBlock label={t("after")} value={r.after} />
                          </div>
                          {r.ipAddress && <p className="mt-2 text-xs text-muted">IP {r.ipAddress}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            {t("previous")}
          </Button>
          <span className="text-muted">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-md bg-surface p-3 text-xs" dir="ltr">
        {value == null ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
