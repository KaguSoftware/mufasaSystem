import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type AccordionItem = { q: string; a: string };

/**
 * Accessible disclosure list built on native <details>/<summary>: keyboard and
 * screen reader support come for free, no JS needed.
 */
export function Accordion({ items, className }: { items: readonly AccordionItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border bg-surface shadow-card", className)}>
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-start font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="px-5 pb-5 text-pretty text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
