import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const ATT_TONE: Record<string, BadgeTone> = {
  expected: "neutral",
  present: "success",
  late: "warning",
  absent: "danger",
  excused: "primary",
};

export function AttendanceBadge({ status }: { status: "expected" | "present" | "late" | "absent" | "excused" }) {
  const t = useTranslations("live");
  return <Badge tone={ATT_TONE[status]}>{t(`att.${status}`)}</Badge>;
}

const SES_TONE: Record<string, BadgeTone> = {
  scheduled: "neutral",
  live: "success",
  ended: "neutral",
  cancelled: "danger",
};

export function SessionStatusBadge({ status }: { status: "scheduled" | "live" | "ended" | "cancelled" }) {
  const t = useTranslations("live");
  return <Badge tone={SES_TONE[status]}>{t(`sessionStatus.${status}`)}</Badge>;
}
