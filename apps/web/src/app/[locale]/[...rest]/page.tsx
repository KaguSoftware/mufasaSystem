import { notFound } from "next/navigation";

/** Any unknown /<locale>/... path renders the localized [locale]/not-found.tsx. */
export default function CatchAll() {
  notFound();
}
