"use client";

import { Ban, MoreHorizontal, Plus, Search, ShieldCheck, UserCog, UserRoundCheck, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Role } from "@mufasa/db/schema";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ban, createStaff, familyLinks, impersonate, setRole, unban } from "@/server/actions/admin-users";
import { reviewRequest } from "@/server/actions/data-requests";
import { useErrorText } from "@/components/account/use-action-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

const ROLE_LIST: readonly Role[] = ["admin", "tutor", "parent", "student"];

type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  banned: boolean;
  isManagedChild: boolean;
  createdAt: string;
};
type RequestRow = {
  id: string;
  type: "export" | "delete";
  status: "pending" | "approved" | "rejected" | "completed";
  subjectName: string;
  subjectEmail: string;
  subjectRole: string;
  requestedByName: string;
  createdAt: string;
};

type Props = {
  currentUserId: string;
  tab: "users" | "requests";
  q: string;
  role: Role | null;
  users: { rows: UserRow[]; total: number; page: number; pageSize: number };
  requests: RequestRow[];
};

type DialogState =
  | { kind: "role"; user: UserRow }
  | { kind: "ban"; user: UserRow }
  | { kind: "family"; user: UserRow }
  | null;

export function UsersPanel({ currentUserId, tab, q, role, users, requests }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState(q);
  const pending = requests.filter((r) => r.status === "pending").length;

  function go(params: Record<string, string | null>) {
    const sp = new URLSearchParams();
    const merged = { q: q || null, role, tab: tab === "requests" ? "requests" : null, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <TabsRoot value={tab} onValueChange={(v) => go({ tab: v === "requests" ? "requests" : null, page: null })}>
      <TabsList>
        <TabsTrigger value="users">{t("tabUsers")}</TabsTrigger>
        <TabsTrigger value="requests">
          {t("tabRequests")}
          {pending > 0 && <Badge tone="warning" className="ms-2">{pending}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <form
            className="flex min-w-64 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go({ q: search.trim() || null, page: null });
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchUsers")} className="ps-9" />
            </div>
            <Button type="submit" variant="outline">
              {t("search")}
            </Button>
          </form>
          <div className="w-48">
            <RoleSelect value={role} onChange={(v) => go({ role: v, page: null })} clearable placeholder={t("allRoles")} />
          </div>
          <CreateStaffDialog />
        </div>

        <Card>
          {users.rows.length === 0 ? (
            <EmptyState className="border-0" icon={<Users className="size-8" />} title={t("noUsers")} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>{t("colName")}</Th>
                  <Th>{t("colRole")}</Th>
                  <Th>{t("colStatus")}</Th>
                  <Th>{t("colCreated")}</Th>
                  <Th className="w-12" />
                </tr>
              </THead>
              <TBody>
                {users.rows.map((u) => (
                  <UserRowView key={u.id} u={u} self={u.id === currentUserId} onDialog={setDialog} />
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <Pagination page={users.page} total={users.total} pageSize={users.pageSize} onPage={(p) => go({ page: String(p) })} />
      </TabsContent>

      <TabsContent value="requests">
        <RequestsTable requests={requests} />
      </TabsContent>

      {dialog?.kind === "role" && <RoleDialog user={dialog.user} onClose={() => setDialog(null)} />}
      {dialog?.kind === "ban" && <BanDialog user={dialog.user} onClose={() => setDialog(null)} />}
      {dialog?.kind === "family" && <FamilyDialog user={dialog.user} onClose={() => setDialog(null)} />}
    </TabsRoot>
  );
}

function RoleSelect({
  value,
  onChange,
  clearable,
  placeholder,
  roles = ROLE_LIST,
}: {
  value: Role | null;
  onChange: (v: Role | null) => void;
  clearable?: boolean;
  placeholder?: string;
  roles?: readonly Role[];
}) {
  const t = useTranslations("roles");
  return (
    <Select
      options={roles.map((r) => ({ value: r, label: t(r) }))}
      value={value}
      onChange={(v) => onChange(v as Role | null)}
      clearable={clearable}
      placeholder={placeholder}
      searchable={false}
    />
  );
}

function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const t = useTranslations("admin");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t("previous")}
      </Button>
      <span className="text-muted">
        {page} / {pages} · {t("totalCount", { count: total })}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t("next")}
      </Button>
    </div>
  );
}

function UserRowView({ u, self, onDialog }: { u: UserRow; self: boolean; onDialog: (d: DialogState) => void }) {
  const t = useTranslations("admin");
  const tr = useTranslations("roles");
  const errText = useErrorText();
  const locale = useLocale();
  const router = useRouter();

  async function doUnban() {
    const res = await unban({ userId: u.id });
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("unbanned"));
    router.refresh();
  }
  async function doImpersonate() {
    const res = await impersonate({ userId: u.id });
    if (!res.ok) return toast.error(errText(res.error));
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the new session cookie is picked up
    window.location.assign(`/${locale}/dashboard`);
  }

  return (
    <Tr>
      <Td>
        <div className="font-medium">{u.name}</div>
        <div className="text-xs text-muted">{u.isManagedChild ? `@${u.username ?? ""}` : u.email}</div>
      </Td>
      <Td>
        <Badge tone={u.role === "admin" ? "danger" : u.role === "tutor" ? "primary" : "neutral"}>{tr(u.role)}</Badge>
        {u.isManagedChild && <Badge className="ms-1">{t("child")}</Badge>}
      </Td>
      <Td>{u.banned ? <Badge tone="danger">{t("banned")}</Badge> : <Badge tone="success">{t("active")}</Badge>}</Td>
      <Td className="text-muted">{new Date(u.createdAt).toLocaleDateString(locale)}</Td>
      <Td>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label={t("actions")}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onDialog({ kind: "family", user: u })}>
              <Users />
              {t("familyLinks")}
            </DropdownMenuItem>
            {!self && (
              <>
                <DropdownMenuItem onSelect={() => onDialog({ kind: "role", user: u })}>
                  <UserCog />
                  {t("changeRole")}
                </DropdownMenuItem>
                {u.role !== "admin" && (
                  <DropdownMenuItem onSelect={doImpersonate}>
                    <UserRoundCheck />
                    {t("impersonate")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {u.banned ? (
                  <DropdownMenuItem onSelect={doUnban}>
                    <ShieldCheck />
                    {t("unban")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem tone="danger" onSelect={() => onDialog({ kind: "ban", user: u })}>
                    <Ban />
                    {t("ban")}
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Td>
    </Tr>
  );
}

function RoleDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const t = useTranslations("admin");
  const errText = useErrorText();
  const router = useRouter();
  const [role, setRoleValue] = useState<Role | null>(user.role);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setBusy(true);
    const res = await setRole({ userId: user.id, role });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("roleChanged"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("changeRoleTitle", { name: user.name })} description={t("changeRoleHint")} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <RoleSelect value={role} onChange={setRoleValue} />
          <DialogFooter>
            <Button type="submit" loading={busy} disabled={!role || role === user.role}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BanDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const t = useTranslations("admin");
  const errText = useErrorText();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await ban({ userId: user.id, reason: reason.trim() || undefined });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("bannedDone"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("banTitle", { name: user.name })} description={t("banHint")} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("banReason")} htmlFor="ban-reason">
            <Input id="ban-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="danger" loading={busy}>
              {t("ban")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FamilyDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const t = useTranslations("admin");
  const [data, setData] = useState<{ parents: { id: string; name: string; email: string }[]; children: { id: string; name: string; username: string | null }[] } | null>(null);

  useEffect(() => {
    let live = true;
    void familyLinks({ userId: user.id }).then((res) => {
      if (!live) return;
      if (res.ok) setData(res.data);
      else toast.error(t("loadFailed"));
    });
    return () => {
      live = false;
    };
  }, [user.id, t]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("familyTitle", { name: user.name })} size="md">
        {!data ? (
          <p className="text-sm text-muted">{t("loading")}</p>
        ) : data.parents.length === 0 && data.children.length === 0 ? (
          <p className="text-sm text-muted">{t("noFamily")}</p>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            {data.parents.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">{t("parents")}</h4>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.parents.map((p) => (
                    <li key={p.id} className="px-3 py-2">
                      {p.name} <span className="text-muted">{p.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.children.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">{t("children")}</h4>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.children.map((c) => (
                    <li key={c.id} className="px-3 py-2">
                      {c.name} {c.username && <span className="text-muted">@{c.username}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateStaffDialog() {
  const t = useTranslations("admin");
  const errText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRoleValue] = useState<Role | null>("tutor");
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    if (!role || (role !== "tutor" && role !== "admin")) return;
    setBusy(true);
    const res = await createStaff({ name: name.trim(), email: email.trim(), password, role });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "conflict") return setFieldError(t("emailTaken"));
      return toast.error(errText(res.error));
    }
    toast.success(t("staffCreated"));
    setOpen(false);
    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("createStaff")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("createStaff")} description={t("createStaffHint")} size="md">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label={t("colName")} htmlFor="st-name" required>
              <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("email")} htmlFor="st-email" error={fieldError ?? undefined} required>
              <Input id="st-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("tempPassword")} htmlFor="st-pass" hint={t("tempPasswordHint")} required>
              <Input id="st-pass" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t("colRole")}>
              <RoleSelect value={role} onChange={setRoleValue} roles={["tutor", "admin"]} />
            </Field>
            <DialogFooter>
              <Button type="submit" loading={busy} disabled={!name.trim() || !email.trim() || password.length < 10}>
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RequestsTable({ requests }: { requests: RequestRow[] }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const errText = useErrorText();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(requestId: string, decision: "approve" | "reject") {
    setBusy(`${requestId}:${decision}`);
    const res = await reviewRequest({ requestId, decision });
    setBusy(null);
    if (!res.ok) {
      if (res.error.code === "conflict") return toast.error(t("requestBlocked"));
      return toast.error(errText(res.error));
    }
    toast.success(decision === "approve" ? t("requestApproved") : t("requestRejected"));
    router.refresh();
  }

  if (requests.length === 0) return <EmptyState icon={<ShieldCheck className="size-8" />} title={t("noRequests")} />;
  const tone = { pending: "warning", approved: "primary", rejected: "danger", completed: "success" } as const;
  return (
    <Card>
      <Table>
        <THead>
          <tr>
            <Th>{t("colSubject")}</Th>
            <Th>{t("colType")}</Th>
            <Th>{t("colRequestedBy")}</Th>
            <Th>{t("colStatus")}</Th>
            <Th>{t("colCreated")}</Th>
            <Th />
          </tr>
        </THead>
        <TBody>
          {requests.map((r) => (
            <Tr key={r.id}>
              <Td>
                <div className="font-medium">{r.subjectName}</div>
                <div className="text-xs text-muted">{r.subjectEmail}</div>
              </Td>
              <Td>{r.type === "export" ? t("typeExport") : t("typeDelete")}</Td>
              <Td>{r.requestedByName}</Td>
              <Td>
                <Badge tone={tone[r.status]}>{t(`status_${r.status}`)}</Badge>
              </Td>
              <Td className="text-muted">{new Date(r.createdAt).toLocaleDateString(locale)}</Td>
              <Td>
                {r.status === "pending" && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" loading={busy === `${r.id}:reject`} onClick={() => decide(r.id, "reject")}>
                      {t("reject")}
                    </Button>
                    <Button size="sm" variant={r.type === "delete" ? "danger" : "primary"} loading={busy === `${r.id}:approve`} onClick={() => decide(r.id, "approve")}>
                      {r.type === "delete" ? t("approveDelete") : t("approve")}
                    </Button>
                  </div>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
