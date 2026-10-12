"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell, LogOut, Menu, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { brand } from "@mufasa/config/brand";
import type { Role } from "@mufasa/db/schema";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { SheetContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/misc";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LocaleSwitcher, ThemeToggle } from "./switchers";
import { NAV } from "./nav";

export type ShellUser = { name: string; email: string; role: Role; image?: string | null };

export function PanelShell({
  role,
  user,
  unreadCount = 0,
  children,
}: {
  role: Role;
  user: ShellUser | null;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-border bg-surface lg:block">
        <Sidebar role={role} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar role={role} user={user} unreadCount={unreadCount} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const t = useTranslations(`panel.${role}`);
  const pathname = usePathname();
  const items = NAV[role];
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex h-16 items-center gap-2 border-b border-border px-5 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg">
          {brand.shortName[0]}
        </span>
        {brand.name}
      </Link>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-3">
          {items.map((item) => {
            const active = item.href === `/${role}` ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text",
                  active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {t(item.key as never)}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

function Topbar({ role, user, unreadCount }: { role: Role; user: ShellUser | null; unreadCount: number }) {
  const t = useTranslations();
  const router = useRouter();

  async function logout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6">
      <Dialog.Root>
        <Dialog.Trigger className="rounded-md p-2 hover:bg-surface-2 lg:hidden" aria-label="Menu">
          <Menu className="size-5" />
        </Dialog.Trigger>
        <SheetContent title={brand.name} side="start" className="p-0 [&>div:last-child]:p-0">
          <Sidebar role={role} />
        </SheetContent>
      </Dialog.Root>

      <Badge tone="primary" className="hidden sm:inline-flex">
        {t(`roles.${role}`)}
      </Badge>

      <div className="ms-auto flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
        <Link
          href={`/${role}/notifications`}
          className="relative rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
          aria-label={t("panel.notifications")}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute end-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="ms-1 flex items-center gap-2 rounded-full p-0.5 outline-none hover:bg-surface-2 focus-visible:ring-4 focus-visible:ring-ring">
              <Avatar name={user.name} src={user.image} size={34} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel className="text-sm text-text">
                <span className="block truncate font-medium">{user.name}</span>
                <span className="block truncate text-xs font-normal text-muted">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${role}/account`}>
                  <User /> {t("nav.myAccount")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={logout}>
                <LogOut /> {t("nav.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
