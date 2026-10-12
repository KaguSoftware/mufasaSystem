import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

/** Panel areas that require a session cookie (optimistic check only). */
const PROTECTED = /^\/(en|ar|tr)\/(student|parent|tutor|admin|dashboard|onboarding|live)(\/|$)/;

/**
 * Locale routing + an OPTIMISTIC auth redirect. This only checks that a session
 * cookie exists; real authorization happens in the DAL (server/session.ts)
 * and in each panel layout via requireRole().
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const m = pathname.match(PROTECTED);
  // Before the DB is connected, let panels render (PanelGate shows a notice) so the UI can be browsed.
  if (m && process.env.DATABASE_URL && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${m[1]}/sign-in`;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return intl(request);
}

export const config = {
  // Skip API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|verify-cert|.*\\..*).*)"],
};
