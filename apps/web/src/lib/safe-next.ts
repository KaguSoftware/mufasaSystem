/** Returns `next` only if it is a same-origin absolute path (no scheme, no protocol-relative, no backslashes). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  for (let i = 0; i < next.length; i++) if (next.charCodeAt(i) < 32) return null;
  return next;
}
