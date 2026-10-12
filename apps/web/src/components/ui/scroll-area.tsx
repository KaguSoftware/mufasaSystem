"use client";

import * as SA from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/cn";

/**
 * Overlay scroll area with a custom thumb (looks identical on every OS).
 * Page-level scrolling uses the global CSS scrollbar styling in globals.css;
 * use this for panels, sidebars, popovers and lists.
 */
export function ScrollArea({
  className,
  viewportClassName,
  children,
  orientation = "vertical",
  ...props
}: SA.ScrollAreaProps & { viewportClassName?: string; orientation?: "vertical" | "horizontal" | "both" }) {
  return (
    <SA.Root className={cn("relative overflow-hidden", className)} {...props}>
      <SA.Viewport className={cn("size-full rounded-[inherit]", viewportClassName)}>{children}</SA.Viewport>
      {(orientation === "vertical" || orientation === "both") && <Bar orientation="vertical" />}
      {(orientation === "horizontal" || orientation === "both") && <Bar orientation="horizontal" />}
      <SA.Corner />
    </SA.Root>
  );
}

function Bar({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <SA.Scrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none select-none p-0.5 transition-opacity duration-150 data-[state=hidden]:opacity-0",
        orientation === "vertical" ? "h-full w-2.5" : "h-2.5 flex-col",
      )}
    >
      <SA.Thumb className="relative flex-1 rounded-full bg-[var(--scrollbar)] hover:bg-[var(--scrollbar-hover)]" />
    </SA.Scrollbar>
  );
}
