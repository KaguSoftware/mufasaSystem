"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in";

export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  ...props
}: D.DialogContentProps & { title: React.ReactNode; description?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed start-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] -translate-y-1/2 animate-pop-in flex-col rounded-xl border border-border bg-surface shadow-pop ltr:-translate-x-1/2 rtl:translate-x-1/2",
          widths[size],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="rounded-sm p-1 text-muted transition-colors hover:bg-surface-2 hover:text-text">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-border px-6 py-4", className)} {...props} />;
}

/** Side drawer (mobile nav, filters, detail panes). `side="end"` respects RTL. */
export function SheetContent({
  className,
  children,
  title,
  side = "end",
  ...props
}: D.DialogContentProps & { title: React.ReactNode; side?: "start" | "end" }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full max-w-sm animate-fade-in flex-col border-border bg-surface shadow-pop",
          side === "end" ? "end-0 border-s" : "start-0 border-e",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <D.Title className="font-semibold">{title}</D.Title>
          <D.Description className="sr-only">{title}</D.Description>
          <D.Close className="rounded-sm p-1 text-muted hover:bg-surface-2 hover:text-text">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
