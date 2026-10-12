import { brand } from "@mufasa/config/brand";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher, ThemeToggle } from "@/components/shell/switchers";

/** Centered card layout shared by sign-in, sign-up, verify and password reset. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="text-lg font-semibold">
          {brand.name}
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
