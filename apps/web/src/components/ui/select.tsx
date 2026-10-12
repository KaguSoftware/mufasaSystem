"use client";

import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
};

type BaseProps = {
  options: SelectOption[];
  placeholder?: string;
  /** Show a search box (auto-on for more than 8 options). */
  searchable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
  name?: string;
  /** Allow clearing the value. */
  clearable?: boolean;
  emptyText?: string;
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
};
type MultiProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

/**
 * Fully custom select / combobox / multi-select. No native <select> anywhere.
 * Keyboard: arrows, enter, type-to-search, esc. RTL aware via logical classes.
 * Renders a hidden input when `name` is set so it works inside plain <form>s.
 */
export function Select(props: SingleProps | MultiProps) {
  const t = useTranslations("common");
  const { options, placeholder, disabled, invalid, className, id, name, clearable, emptyText } = props;
  const [open, setOpen] = useState(false);
  const searchable = props.searchable ?? options.length > 8;

  const rawValue = props.value;
  const selected = useMemo(
    () => (Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : []),
    [rawValue],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const groups = useMemo(() => {
    const m = new Map<string, SelectOption[]>();
    for (const o of options) {
      const g = o.group ?? "";
      m.set(g, [...(m.get(g) ?? []), o]);
    }
    return [...m.entries()];
  }, [options]);

  function toggle(v: string) {
    if (props.multiple) {
      props.onChange(selectedSet.has(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
      setOpen(false);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    if (props.multiple) props.onChange([]);
    else props.onChange(null);
  }

  const display = props.multiple ? (
    selected.length ? (
      <span className="flex flex-wrap gap-1">
        {selected.slice(0, 3).map((v) => (
          <span key={v} className="rounded-sm bg-primary-soft px-1.5 py-0.5 text-xs text-primary">
            {byValue.get(v)?.label ?? v}
          </span>
        ))}
        {selected.length > 3 && <span className="text-xs text-muted">+{selected.length - 3}</span>}
      </span>
    ) : null
  ) : selected[0] ? (
    <span className="flex items-center gap-2 truncate">
      {byValue.get(selected[0])?.icon}
      {byValue.get(selected[0])?.label ?? selected[0]}
    </span>
  ) : null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? `${id ?? "select"}-list` : undefined}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-start text-sm transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger data-[state=open]:border-primary data-[state=open]:ring-4 data-[state=open]:ring-ring",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !display && "text-muted")}>
            {display ?? placeholder ?? t("selectPlaceholder")}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-muted">
            {clearable && selected.length > 0 && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={t("remove")}
                onClick={clear}
                className="rounded-sm p-0.5 hover:bg-surface-3 hover:text-text"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown className="size-4" />
          </span>
        </button>
      </Popover.Trigger>
      {name &&
        (props.multiple ? (
          props.value.map((v) => <input key={v} type="hidden" name={name} value={v} />)
        ) : (
          <input type="hidden" name={name} value={props.value ?? ""} />
        ))}
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-48 animate-pop-in overflow-hidden rounded-md border border-border bg-surface shadow-pop"
        >
          <Command id={`${id ?? "select"}-list`} loop className="flex flex-col" filter={(value, search, keywords) => {
            const hay = `${value} ${(keywords ?? []).join(" ")}`.toLocaleLowerCase();
            return hay.includes(search.toLocaleLowerCase()) ? 1 : 0;
          }}>
            {searchable && (
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="size-4 shrink-0 text-muted" />
                <Command.Input
                  autoFocus
                  placeholder={t("searchPlaceholder")}
                  className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
            )}
            <Command.List className="max-h-72 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
                {emptyText ?? t("noResults")}
              </Command.Empty>
              {groups.map(([group, items]) => (
                <Command.Group
                  key={group || "_"}
                  heading={group || undefined}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
                >
                  {items.map((o) => {
                    const isSel = selectedSet.has(o.value);
                    return (
                      <Command.Item
                        key={o.value}
                        value={o.value}
                        keywords={[o.label, o.description ?? ""]}
                        disabled={o.disabled}
                        onSelect={() => toggle(o.value)}
                        className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-surface-2 data-[disabled=true]:opacity-50"
                      >
                        {props.multiple ? (
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                              isSel ? "border-primary bg-primary text-primary-fg" : "border-border-strong",
                            )}
                          >
                            {isSel && <Check className="size-3" strokeWidth={3} />}
                          </span>
                        ) : null}
                        {o.icon}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{o.label}</span>
                          {o.description && <span className="block truncate text-xs text-muted">{o.description}</span>}
                        </span>
                        {!props.multiple && isSel && <Check className="size-4 shrink-0 text-primary" />}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
