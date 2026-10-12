import { cn } from "@/lib/cn";

/** Page-width container used by every public section. Restyle spacing here. */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function Section({
  tone = "plain",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: "plain" | "soft" }) {
  return (
    <section className={cn("py-14 sm:py-20", tone === "soft" && "bg-surface-2", className)} {...props}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  title,
  subtitle,
  align = "center",
  as: Tag = "h2",
  className,
}: {
  title: string;
  subtitle?: string;
  align?: "center" | "start";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("mb-10 max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <Tag className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</Tag>
      {subtitle && <p className="mt-3 text-pretty text-lg text-muted">{subtitle}</p>}
    </div>
  );
}

/** Top banner of inner pages (programs, pricing, faq ...). */
export function PageHero({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-border bg-primary-soft">
      <Decor />
      <Container className="relative py-12 sm:py-16">
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-pretty text-lg text-muted">{subtitle}</p>}
        {children}
      </Container>
    </div>
  );
}

/** Soft decorative blobs (pure CSS, token colors). Safe to delete or replace. */
export function Decor({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -top-24 -end-24 size-72 rounded-full bg-accent-soft blur-2xl" />
      <div className="absolute -bottom-32 -start-20 size-72 rounded-full bg-surface/60 blur-2xl" />
    </div>
  );
}
