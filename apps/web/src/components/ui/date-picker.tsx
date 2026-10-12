"use client";

import * as Popover from "@radix-ui/react-popover";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  type Locale as DfLocale,
} from "date-fns";
import { arSA, enUS, tr } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/cn";

const dfLocales: Record<string, DfLocale> = { en: enUS, ar: arSA, tr };

/**
 * Custom calendar date picker (no native <input type="date">).
 * Value is a local date string "yyyy-MM-dd" so it serializes cleanly.
 * Pass `withTime` to add an "HH:mm" time field; value becomes "yyyy-MM-ddTHH:mm".
 */
export function DatePicker({
  value,
  onChange,
  withTime,
  min,
  max,
  placeholder,
  disabled,
  invalid,
  className,
  name,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  withTime?: boolean;
  min?: Date;
  max?: Date;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  name?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const df = dfLocales[locale] ?? enUS;
  const parsed = value ? new Date(withTime ? value : `${value}T00:00`) : null;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parsed ?? new Date()));
  const time = value && withTime ? value.slice(11, 16) : "09:00";

  const gridStart = startOfWeek(month, { locale: df });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekdays = days.slice(0, 7).map((d) => format(d, "EEEEEE", { locale: df }));

  function pick(d: Date) {
    const day = format(d, "yyyy-MM-dd");
    onChange(withTime ? `${day}T${time}` : day);
    if (!withTime) setOpen(false);
  }

  const outOfRange = (d: Date) => (min && d < addDays(min, -1)) || (max && d > max);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          data-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border border-border bg-surface px-3 text-start text-sm transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring disabled:opacity-60 data-[invalid=true]:border-danger data-[state=open]:border-primary data-[state=open]:ring-4 data-[state=open]:ring-ring",
            className,
          )}
        >
          <CalendarDays className="size-4 text-muted" />
          <span className={cn("flex-1 truncate", !parsed && "text-muted")}>
            {parsed ? format(parsed, withTime ? "PPP p" : "PPP", { locale: df }) : (placeholder ?? t("selectPlaceholder"))}
          </span>
        </button>
      </Popover.Trigger>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-72 animate-pop-in rounded-md border border-border bg-surface p-3 shadow-pop">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="rounded-sm p-1.5 hover:bg-surface-2" aria-label={t("previous")}>
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </button>
            <span className="text-sm font-medium">{format(month, "LLLL yyyy", { locale: df })}</span>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="rounded-sm p-1.5 hover:bg-surface-2" aria-label={t("next")}>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted">
            {weekdays.map((w, i) => (
              <span key={i} className="py-1">{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const sel = parsed && isSameDay(d, parsed);
              const today = isSameDay(d, new Date());
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={Boolean(outOfRange(d))}
                  onClick={() => pick(d)}
                  className={cn(
                    "h-8 rounded-sm text-sm tabular-nums transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-30",
                    !isSameMonth(d, month) && "text-muted/60",
                    today && !sel && "font-semibold text-primary",
                    sel && "bg-primary text-primary-fg hover:bg-primary-hover",
                  )}
                >
                  {format(d, "d", { locale: df })}
                </button>
              );
            })}
          </div>
          {withTime && (
            <TimeField
              value={time}
              onChange={(tm) => onChange(`${format(parsed ?? new Date(), "yyyy-MM-dd")}T${tm}`)}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Custom HH:mm picker: two scrollable columns, 5-minute steps. */
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  const col = (items: string[], cur: string | undefined, set: (v: string) => void) => (
    <div className="h-32 flex-1 overflow-y-auto rounded-sm border border-border p-1">
      {items.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v)}
          className={cn("block w-full rounded-sm py-1 text-sm tabular-nums hover:bg-surface-2", v === cur && "bg-primary-soft font-medium text-primary")}
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <div className="mt-3 flex gap-2 border-t border-border pt-3" dir="ltr">
      {col(hours, h, (v) => onChange(`${v}:${m ?? "00"}`))}
      {col(mins, m, (v) => onChange(`${h ?? "09"}:${v}`))}
    </div>
  );
}
