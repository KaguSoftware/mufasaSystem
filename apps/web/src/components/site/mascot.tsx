import Image from "next/image";
import { brand } from "@mufasa/config/brand";
import { cn } from "@/lib/cn";

/** The brand mascot (placeholder owl). Swap /public/brand/mascot.svg to restyle. */
export function Mascot({ alt, className, priority }: { alt: string; className?: string; priority?: boolean }) {
  return (
    <Image
      src={brand.mascot.avatar}
      alt={alt}
      width={240}
      height={240}
      priority={priority}
      unoptimized
      className={cn("h-auto w-full", className)}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return <Image src={brand.logo} alt="" width={32} height={32} unoptimized className={cn("size-8", className)} />;
}
