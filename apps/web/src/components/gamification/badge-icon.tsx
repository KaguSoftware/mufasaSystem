import { Award, BookOpen, Flame, GraduationCap, Medal, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  star: Star,
  flame: Flame,
  trophy: Trophy,
  zap: Zap,
  book: BookOpen,
  award: Award,
  medal: Medal,
  target: Target,
  graduation: GraduationCap,
  sparkles: Sparkles,
} as const;

/** Maps a badge's `icon` string to a lucide icon (unknown names fall back to a star). */
export function BadgeIcon({ name, earned, className }: { name: string; earned: boolean; className?: string }) {
  const Icon = (ICONS as Record<string, typeof Star>)[name] ?? Star;
  return (
    <span
      className={cn(
        "flex size-14 items-center justify-center rounded-full",
        earned ? "bg-accent-soft text-warning" : "bg-surface-3 text-muted opacity-60",
        className,
      )}
    >
      <Icon className="size-7" />
    </span>
  );
}
