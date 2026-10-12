import { toNextJsHandler } from "better-auth/next-js";
import { isConfigured } from "@/env";
import { getAuth } from "@/server/auth";

const notConfigured = () =>
  Response.json({ error: "Auth is not configured (DATABASE_URL / BETTER_AUTH_SECRET)." }, { status: 503 });

export async function GET(req: Request) {
  if (!isConfigured("auth")) return notConfigured();
  return toNextJsHandler(getAuth()).GET(req);
}

export async function POST(req: Request) {
  if (!isConfigured("auth")) return notConfigured();
  return toNextJsHandler(getAuth()).POST(req);
}
