"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Checkbox, RadioGroup, Switch, TabsContent, TabsList, TabsRoot, TabsTrigger, Tooltip } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Avatar, EmptyState, PageHeader, Progress, Skeleton, Spinner } from "@/components/ui/misc";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { LocaleSwitcher, ThemeToggle } from "@/components/shell/switchers";

const surahs = [
  "Al-Fatihah", "Al-Baqarah", "Aal-Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal",
  "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim",
].map((n, i) => ({ value: String(i + 1), label: `${i + 1}. ${n}`, group: i < 7 ? "Juz 1-8" : "Juz 9-13" }));

export function UiShowcase() {
  const [program, setProgram] = useState<string | null>("quran");
  const [surah, setSurah] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>(["mon", "wed"]);
  const [date, setDate] = useState<string | null>(null);
  const [dateTime, setDateTime] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState("monthly");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="UI kit"
        description="Every primitive in one place. Switch to /ar/ui to check RTL."
        actions={
          <>
            <LocaleSwitcher />
            <ThemeToggle />
          </>
        }
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader title="Buttons & badges" />
          <CardBody className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Saving</Button>
            <Button size="icon" variant="secondary" aria-label="Add"><Plus className="size-4" /></Button>
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="success">Active</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="danger">Expired</Badge>
          </CardBody>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Active students" value="128" hint="+12 this week" />
          <Stat label="Lessons completed" value="2,431" />
          <Stat label="Pending receipts" value="4" />
        </div>

        <Card>
          <CardHeader title="Form controls" description="Custom select, combobox, multi-select, date and time pickers" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" required><Input placeholder="Amina" /></Field>
            <Field label="Program" hint="Simple select">
              <Select
                value={program}
                onChange={setProgram}
                options={[
                  { value: "quran", label: "Quran" },
                  { value: "arabic", label: "Arabic Language" },
                  { value: "tajweed", label: "Tajweed", description: "Rules of recitation" },
                ]}
              />
            </Field>
            <Field label="Surah" hint="Searchable, grouped, clearable">
              <Select value={surah} onChange={setSurah} options={surahs} clearable />
            </Field>
            <Field label="Class days" hint="Multi-select">
              <Select
                multiple
                value={days}
                onChange={setDays}
                options={["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => ({ value: d, label: d.toUpperCase() }))}
              />
            </Field>
            <Field label="Date"><DatePicker value={date} onChange={setDate} /></Field>
            <Field label="Date & time"><DatePicker value={dateTime} onChange={setDateTime} withTime /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea placeholder="Anything the tutor should know…" /></Field>
            <Field label="Error state" error="This field is required"><Input aria-invalid /></Field>
            <div className="flex flex-col gap-3">
              <Checkbox label="Send WhatsApp reminder" defaultChecked />
              <Switch label="Allow AI feedback" defaultChecked />
            </div>
            <RadioGroup
              className="sm:col-span-2"
              value={plan}
              onValueChange={setPlan}
              options={[
                { value: "monthly", label: "Monthly", description: "Billed every month" },
                { value: "yearly", label: "Yearly", description: "Two months free" },
              ]}
            />
            <FileDropzone className="sm:col-span-2" label="Upload receipt" hint="PDF or image, max 10 MB" accept="image/*,application/pdf" maxSizeMb={10} value={file} onChange={setFile} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Overlays"
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="More"><MoreHorizontal className="size-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem><Pencil /> Edit</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem tone="danger"><Trash2 /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
          <CardBody className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger>
              <DialogContent title="Grant access" description="Give this student access after their IBAN payment.">
                <Field label="Until"><DatePicker value={date} onChange={setDate} /></Field>
                <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                  <Button>Grant</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="secondary" onClick={() => toast.success("Access granted until 12 Nov")}>Toast</Button>
            <Tooltip content="Tooltips work in RTL too"><Button variant="outline">Hover me</Button></Tooltip>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tabs, table, scroll area" />
          <CardBody>
            <TabsRoot defaultValue="table">
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="scroll">Scroll area</TabsTrigger>
                <TabsTrigger value="misc">Misc</TabsTrigger>
              </TabsList>
              <TabsContent value="table">
                <Table>
                  <THead><Tr><Th>Student</Th><Th>Program</Th><Th>Status</Th><Th>Progress</Th></Tr></THead>
                  <TBody>
                    {["Amina", "Yusuf", "Zeynep"].map((n, i) => (
                      <Tr key={n}>
                        <Td><span className="flex items-center gap-2"><Avatar name={n} size={28} />{n}</span></Td>
                        <Td>Quran</Td>
                        <Td><Badge tone={i === 1 ? "warning" : "success"}>{i === 1 ? "Pending" : "Active"}</Badge></Td>
                        <Td className="w-40"><Progress value={30 + i * 25} /></Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TabsContent>
              <TabsContent value="scroll">
                <ScrollArea className="h-48 rounded-md border border-border">
                  <div className="p-4">
                    {Array.from({ length: 40 }, (_, i) => (
                      <p key={i} className="py-1 text-sm">Ayah {i + 1}</p>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="misc" className="grid gap-4">
                <div className="flex items-center gap-3"><Spinner /><Skeleton className="h-4 w-48" /></div>
                <p className="quran text-2xl">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>
                <EmptyState title="No homework yet" description="Assignments from your tutor will appear here." />
              </TabsContent>
            </TabsRoot>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
