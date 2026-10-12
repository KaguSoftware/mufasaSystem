import { NextResponse } from "next/server";
import { locales, defaultLocale } from "@mufasa/config/locales";
import { env } from "@/env";
import { apiError } from "@/server/action";
import { finalizeCheckout } from "@/server/dal/billing-iyzico";

/**
 * iyzico redirects (POST form with `token`, sometimes GET) here after the hosted checkout.
 * We verify the token with iyzico, activate the pending subscription and redirect to the billing page.
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  const sub = url.searchParams.get("sub");
  const rawLocale = url.searchParams.get("locale") ?? defaultLocale;
  const locale = (locales as readonly string[]).includes(rawLocale) ? rawLocale : defaultLocale;
  let token = url.searchParams.get("token");
  if (!token && req.method === "POST") {
    const form = await req.formData().catch(() => null);
    token = (form?.get("token") as string | null) ?? null;
  }
  const back = (role: string, status: string) =>
    NextResponse.redirect(new URL(`/${locale}/${role}/billing?status=${status}`, env().APP_URL), 303);

  if (!sub || !token) return back("parent", "failed");
  try {
    const out = await finalizeCheckout(sub, token);
    return back(out.role, out.status);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[iyzico callback]", err);
    return apiError(err);
  }
}

export const POST = handle;
export const GET = handle;
