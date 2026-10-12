"use client";

import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";

export function ChildPicker({ options, value }: { options: { id: string; name: string }[]; value: string }) {
  const t = useTranslations("hifz");
  const router = useRouter();
  return (
    <div className="w-64">
      <Select
        value={value}
        onChange={(v) => v && router.push(`/parent/progress?child=${v}`)}
        options={options.map((c) => ({ value: c.id, label: c.name }))}
      />
    </div>
  );
}
