"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;
export const DropdownMenuSub = DM.Sub;
export const DropdownMenuRadioGroup = DM.RadioGroup;

const panel =
  "z-50 min-w-48 animate-pop-in overflow-hidden rounded-md border border-border bg-surface p-1 text-sm shadow-pop";
const item =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-2 outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

export function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: DM.DropdownMenuContentProps) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={sideOffset} align={align} className={cn(panel, className)} {...props} />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  tone,
  ...props
}: DM.DropdownMenuItemProps & { tone?: "danger" }) {
  return <DM.Item className={cn(item, tone === "danger" && "text-danger", className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: DM.DropdownMenuCheckboxItemProps) {
  return (
    <DM.CheckboxItem className={cn(item, "pe-8", className)} {...props}>
      {children}
      <DM.ItemIndicator className="absolute end-2">
        <Check />
      </DM.ItemIndicator>
    </DM.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: DM.DropdownMenuRadioItemProps) {
  return (
    <DM.RadioItem className={cn(item, "pe-8", className)} {...props}>
      {children}
      <DM.ItemIndicator className="absolute end-2">
        <Check />
      </DM.ItemIndicator>
    </DM.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: DM.DropdownMenuLabelProps) {
  return <DM.Label className={cn("px-2 py-1.5 text-xs font-medium text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: DM.DropdownMenuSeparatorProps) {
  return <DM.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuSubTrigger({ className, children, ...props }: DM.DropdownMenuSubTriggerProps) {
  return (
    <DM.SubTrigger className={cn(item, "data-[state=open]:bg-surface-2", className)} {...props}>
      {children}
      <ChevronRight className="ms-auto rtl:rotate-180" />
    </DM.SubTrigger>
  );
}

export function DropdownMenuSubContent({ className, ...props }: DM.DropdownMenuSubContentProps) {
  return (
    <DM.Portal>
      <DM.SubContent className={cn(panel, className)} {...props} />
    </DM.Portal>
  );
}
