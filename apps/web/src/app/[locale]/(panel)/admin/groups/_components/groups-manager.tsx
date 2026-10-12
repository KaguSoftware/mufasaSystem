"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Pencil, Plus, UsersRound, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { addGroupMember, createGroup, removeGroupMember, updateGroup } from "@/server/actions/live";
import { useLiveError } from "@/components/live/use-live-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

type Person = { id: string; name: string };
type Group = {
  id: string;
  name: string;
  tutorId: string;
  tutorName: string;
  programId: string | null;
  courseId: string | null;
  capacity: number;
  ageMin: number | null;
  ageMax: number | null;
  active: boolean;
  members: Person[];
};
type Program = { id: string; label: string };
type Course = { id: string; programId: string; label: string };

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 3);
const num = (v: string) => (v === "" ? null : Number(v));

export function GroupsManager({
  groups,
  tutors,
  students,
  programs,
  courses,
}: {
  groups: Group[];
  tutors: Person[];
  students: Person[];
  programs: Program[];
  courses: Course[];
}) {
  const t = useTranslations("live");
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  const programLabel = (id: string | null) => programs.find((p) => p.id === id)?.label;
  const courseLabel = (id: string | null) => courses.find((c) => c.id === id)?.label;
  const managed = groups.find((g) => g.id === managing) ?? null;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          {t("newGroup")}
        </Button>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={<UsersRound className="size-8" />} title={t("noGroups")} description={t("noGroupsHint")} />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>{t("groupName")}</Th>
                <Th>{t("tutor")}</Th>
                <Th>{t("programCourse")}</Th>
                <Th>{t("members")}</Th>
                <Th>{t("ages")}</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {groups.map((g) => (
                <Tr key={g.id}>
                  <Td>
                    <span className="font-medium">{g.name}</span>
                    {!g.active && (
                      <Badge className="ms-2" tone="neutral">
                        {t("inactive")}
                      </Badge>
                    )}
                  </Td>
                  <Td>{g.tutorName}</Td>
                  <Td className="text-muted">{[programLabel(g.programId), courseLabel(g.courseId)].filter(Boolean).join(" / ") || "-"}</Td>
                  <Td className="tabular-nums">
                    {g.members.length}/{g.capacity}
                  </Td>
                  <Td className="tabular-nums text-muted">{g.ageMin || g.ageMax ? `${g.ageMin ?? "?"}-${g.ageMax ?? "?"}` : "-"}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setManaging(g.id)}>
                        <UsersRound className="size-4" />
                        {t("manageMembers")}
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={t("editGroup")} onClick={() => setEditing(g)}>
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {editing && (
        <GroupDialog
          key={editing === "new" ? "new" : editing.id}
          group={editing === "new" ? null : editing}
          tutors={tutors}
          programs={programs}
          courses={courses}
          onClose={() => setEditing(null)}
        />
      )}
      {managed && <MembersDialog group={managed} students={students} onClose={() => setManaging(null)} />}
    </>
  );
}

function GroupDialog({
  group,
  tutors,
  programs,
  courses,
  onClose,
}: {
  group: Group | null;
  tutors: Person[];
  programs: Program[];
  courses: Course[];
  onClose: () => void;
}) {
  const t = useTranslations("live");
  const tc = useTranslations("common");
  const errText = useLiveError();
  const router = useRouter();
  const [name, setName] = useState(group?.name ?? "");
  const [tutorId, setTutorId] = useState<string | null>(group?.tutorId ?? null);
  const [programId, setProgramId] = useState<string | null>(group?.programId ?? null);
  const [courseId, setCourseId] = useState<string | null>(group?.courseId ?? null);
  const [capacity, setCapacity] = useState(String(group?.capacity ?? 8));
  const [ageMin, setAgeMin] = useState(group?.ageMin != null ? String(group.ageMin) : "");
  const [ageMax, setAgeMax] = useState(group?.ageMax != null ? String(group.ageMax) : "");
  const [active, setActive] = useState(group?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const courseOptions = useMemo(
    () => courses.filter((c) => !programId || c.programId === programId).map((c) => ({ value: c.id, label: c.label })),
    [courses, programId],
  );

  async function submit() {
    if (!tutorId) {
      setErrors({ tutorId: [tc("required")] });
      return;
    }
    setBusy(true);
    const data = {
      name,
      tutorId,
      programId,
      courseId,
      capacity: Number(capacity) || 0,
      ageMin: num(ageMin),
      ageMax: num(ageMax),
      active,
    };
    const res = group ? await updateGroup({ groupId: group.id, data }) : await createGroup(data);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.error.fieldErrors ?? {});
      return toast.error(errText(res.error));
    }
    toast.success(t("groupSaved"));
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={group ? t("editGroup") : t("newGroup")} size="md">
        <div className="flex flex-col gap-4">
          <Field label={t("groupName")} error={errors.name} required>
            <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label={t("tutor")} error={errors.tutorId} required>
            <Select
              value={tutorId}
              onChange={setTutorId}
              options={tutors.map((x) => ({ value: x.id, label: x.name }))}
              invalid={Boolean(errors.tutorId)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("program")}>
              <Select
                value={programId}
                clearable
                onChange={(v) => {
                  setProgramId(v);
                  setCourseId(null);
                }}
                options={programs.map((p) => ({ value: p.id, label: p.label }))}
              />
            </Field>
            <Field label={t("course")}>
              <Select value={courseId} clearable onChange={setCourseId} options={courseOptions} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("capacity")} error={errors.capacity}>
              <Input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(digits(e.target.value))} />
            </Field>
            <Field label={t("ageMin")}>
              <Input inputMode="numeric" value={ageMin} onChange={(e) => setAgeMin(digits(e.target.value))} />
            </Field>
            <Field label={t("ageMax")} error={errors.ageMax}>
              <Input inputMode="numeric" value={ageMax} onChange={(e) => setAgeMax(digits(e.target.value))} />
            </Field>
          </div>
          {group && <Switch checked={active} onCheckedChange={setActive} label={t("active")} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={busy} disabled={name.trim().length < 2}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ group, students, onClose }: { group: Group; students: Person[]; onClose: () => void }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const memberIds = new Set(group.members.map((m) => m.id));
  const options = students.filter((s) => !memberIds.has(s.id)).map((s) => ({ value: s.id, label: s.name }));

  async function add() {
    if (!pick) return;
    setBusy(true);
    const res = await addGroupMember({ groupId: group.id, studentId: pick });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    setPick(null);
    router.refresh();
  }
  async function remove(studentId: string) {
    setBusy(true);
    const res = await removeGroupMember({ groupId: group.id, studentId });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={group.name}
        description={t("membersCount", { n: group.members.length, max: group.capacity })}
        size="md"
      >
        <div className="flex items-end gap-2">
          <Field label={t("addMember")} className="flex-1">
            <Select value={pick} onChange={setPick} options={options} placeholder={t("searchStudent")} />
          </Field>
          <Button onClick={add} loading={busy} disabled={!pick}>
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
        <ul className="mt-5 divide-y divide-border rounded-md border border-border">
          {group.members.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{t("noMembers")}</li>}
          {group.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>{m.name}</span>
              <Button size="icon" variant="ghost" aria-label={t("removeMember")} disabled={busy} onClick={() => remove(m.id)}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
