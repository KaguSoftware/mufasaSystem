"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/controls";

export type ConsentValue = {
  allowLiveVideo: boolean;
  allowRecitationRecording: boolean;
  allowAiFeedback: boolean;
  allowSessionRecording: boolean;
};

export const DEFAULT_CONSENT: ConsentValue = {
  allowLiveVideo: true,
  allowRecitationRecording: true,
  allowAiFeedback: true,
  allowSessionRecording: false,
};

const KEYS = ["allowLiveVideo", "allowRecitationRecording", "allowAiFeedback", "allowSessionRecording"] as const;

/** Four consent switches with an explanation each. */
export function ConsentFields({ value, onChange }: { value: ConsentValue; onChange: (v: ConsentValue) => void }) {
  const t = useTranslations("family");
  return (
    <div className="flex flex-col gap-4">
      {KEYS.map((k) => (
        <div key={k} className="flex items-start justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium">{t(k)}</p>
            <p className="text-muted">{t(`${k}Hint`)}</p>
          </div>
          <Switch checked={value[k]} onCheckedChange={(c) => onChange({ ...value, [k]: c })} aria-label={t(k)} />
        </div>
      ))}
    </div>
  );
}
