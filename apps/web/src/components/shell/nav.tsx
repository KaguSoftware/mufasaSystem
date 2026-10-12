import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Megaphone,
  MessageSquare,
  Mic,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Trophy,
  Users,
  UsersRound,
  Video,
  BookMarked,
} from "lucide-react";
import type { Role } from "@mufasa/db/schema";

export type NavItem = { key: string; href: string; icon: React.ComponentType<{ className?: string }> };

/**
 * Sidebar navigation per role. `key` is the message key under panel.<role>.
 * Add a page: create the route under app/[locale]/(panel)/<role>/... and add it here.
 */
export const NAV: Record<Role, NavItem[]> = {
  student: [
    { key: "dashboard", href: "/student", icon: LayoutDashboard },
    { key: "courses", href: "/student/courses", icon: BookOpen },
    { key: "hifz", href: "/student/hifz", icon: BookMarked },
    { key: "recitations", href: "/student/recitations", icon: Mic },
    { key: "classes", href: "/student/classes", icon: Video },
    { key: "homework", href: "/student/homework", icon: ClipboardList },
    { key: "achievements", href: "/student/achievements", icon: Trophy },
    { key: "certificates", href: "/student/certificates", icon: Award },
  ],
  parent: [
    { key: "dashboard", href: "/parent", icon: LayoutDashboard },
    { key: "children", href: "/parent/children", icon: UsersRound },
    { key: "progress", href: "/parent/progress", icon: BarChart3 },
    { key: "billing", href: "/parent/billing", icon: CreditCard },
    { key: "messages", href: "/parent/messages", icon: MessageSquare },
    { key: "settings", href: "/parent/settings", icon: Settings },
  ],
  tutor: [
    { key: "dashboard", href: "/tutor", icon: LayoutDashboard },
    { key: "students", href: "/tutor/students", icon: Users },
    { key: "groups", href: "/tutor/groups", icon: UsersRound },
    { key: "sessions", href: "/tutor/sessions", icon: CalendarDays },
    { key: "reviews", href: "/tutor/reviews", icon: Mic },
    { key: "homework", href: "/tutor/homework", icon: ClipboardList },
    { key: "studio", href: "/tutor/studio", icon: Sparkles },
    { key: "messages", href: "/tutor/messages", icon: MessageSquare },
  ],
  admin: [
    { key: "dashboard", href: "/admin", icon: LayoutDashboard },
    { key: "users", href: "/admin/users", icon: Users },
    { key: "access", href: "/admin/access", icon: ShieldCheck },
    { key: "plans", href: "/admin/plans", icon: Tag },
    { key: "programs", href: "/admin/programs", icon: Layers },
    { key: "courses", href: "/admin/courses", icon: GraduationCap },
    { key: "groups", href: "/admin/groups", icon: UsersRound },
    { key: "studio", href: "/admin/studio", icon: Sparkles },
    { key: "announcements", href: "/admin/announcements", icon: Megaphone },
    { key: "flags", href: "/admin/flags", icon: Flag },
    { key: "audit", href: "/admin/audit", icon: ScrollText },
    { key: "settings", href: "/admin/settings", icon: Settings },
  ],
};

export const HOME_FOR_ROLE: Record<Role, string> = {
  student: "/student",
  parent: "/parent",
  tutor: "/tutor",
  admin: "/admin",
};
