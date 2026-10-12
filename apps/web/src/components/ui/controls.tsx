"use client";

import * as CB from "@radix-ui/react-checkbox";
import * as RG from "@radix-ui/react-radio-group";
import * as SW from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import * as TT from "@radix-ui/react-tooltip";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

// ───────── Checkbox ─────────
export function Checkbox({ className, label, ...props }: CB.CheckboxProps & { label?: React.ReactNode }) {
  const box = (
    <CB.Root
      className={cn(
        "peer flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-border-strong bg-surface transition-colors hover:border-primary focus-visible:ring-4 focus-visible:ring-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CB.Indicator className="text-primary-fg">
        {props.checked === "indeterminate" ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
      </CB.Indicator>
    </CB.Root>
  );
  if (!label) return box;
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
      {box}
      <span>{label}</span>
    </label>
  );
}

// ───────── Switch ─────────
export function Switch({ className, label, ...props }: SW.SwitchProps & { label?: React.ReactNode }) {
  const sw = (
    <SW.Root
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-surface-3 transition-colors focus-visible:ring-4 focus-visible:ring-ring data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SW.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[22px]" />
    </SW.Root>
  );
  if (!label) return sw;
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm">
      {sw}
      <span>{label}</span>
    </label>
  );
}

// ───────── Radio group ─────────
export function RadioGroup({
  options,
  className,
  ...props
}: RG.RadioGroupProps & { options: { value: string; label: React.ReactNode; description?: React.ReactNode }[] }) {
  return (
    <RG.Root className={cn("flex flex-col gap-2", className)} {...props}>
      {options.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-surface-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/40"
        >
          <RG.Item
            value={o.value}
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface focus-visible:ring-4 focus-visible:ring-ring data-[state=checked]:border-primary"
          >
            <RG.Indicator className="size-2.5 rounded-full bg-primary" />
          </RG.Item>
          <span className="text-sm">
            <span className="font-medium">{o.label}</span>
            {o.description && <span className="mt-0.5 block text-muted">{o.description}</span>}
          </span>
        </label>
      ))}
    </RG.Root>
  );
}

// ───────── Tabs ─────────
export const TabsRoot = Tabs.Root;
export const TabsContent = ({ className, ...p }: Tabs.TabsContentProps) => (
  <Tabs.Content className={cn("mt-4 outline-none", className)} {...p} />
);
export function TabsList({ className, ...props }: Tabs.TabsListProps) {
  return <Tabs.List className={cn("inline-flex gap-1 rounded-md bg-surface-2 p-1", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: Tabs.TabsTriggerProps) {
  return (
    <Tabs.Trigger
      className={cn(
        "rounded-sm px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-text data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

// ───────── Tooltip ─────────
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: TT.TooltipContentProps["side"] }) {
  return (
    <TT.Provider delayDuration={250}>
      <TT.Root>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs animate-fade-in rounded-sm bg-text px-2.5 py-1.5 text-xs text-bg shadow-pop"
          >
            {content}
            <TT.Arrow className="fill-text" />
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}
