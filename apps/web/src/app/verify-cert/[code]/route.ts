import { NextResponse } from "next/server";

/**
 * The PDF prints a locale-neutral URL (/verify-cert/<code>); this sends the
 * visitor to the public verification page. The proxy matcher skips this path.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return NextResponse.redirect(new URL(`/en/verify/${encodeURIComponent(code)}`, req.url), 307);
}
