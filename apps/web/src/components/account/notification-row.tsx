"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/server/actions/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function NotificationRow({
  id,
  read,
  href,
  text,
  time,
}: {
  id: string;
  read: boolean;
  href: string | null;
  text: string;
  time: string;
}) {
  const router = useRouter();
  const [isRead, setIsRead] = useState(read);

  async function open() {
    if (!isRead) {
      setIsRead(true);
      await markNotificationRead({ ids: [id] });
    }
    if (href) router.push(href);
    else router.refresh();
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn("flex w-full items-start gap-3 px-5 py-4 text-start transition-colors hover:bg-surface-2", !isRead && "bg-primary-soft/30")}
    >
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", isRead ? "bg-transparent" : "bg-primary")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", !isRead && "font-medium")}>{text}</span>
        <span className="mt-0.5 block text-xs text-muted">{time}</span>
      </span>
    </button>
  );
}

export function MarkAllReadButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await markAllNotificationsRead({});
        setBusy(false);
        router.refresh();
      }}
    >
      <CheckCheck className="size-4" />
      {label}
    </Button>
  );
}
