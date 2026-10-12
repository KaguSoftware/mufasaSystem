import "server-only";
import { z } from "zod";
import { DbNotConfiguredError, type Role } from "@mufasa/db";
import { AppError, type ErrorCode } from "./errors";
import { requireFlag, type FlagKey } from "./flags";
import { enforceRateLimit, type RateLimitKey } from "./rate-limit";
import { requireRole, requireUser, type SessionUser } from "./session";

export type ActionError = { code: ErrorCode; message?: string; fieldErrors?: Record<string, string[]> };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

type Options<S extends z.ZodType> = {
  input: S;
  /** Restrict to roles. Omit = any signed-in user. */
  roles?: Role[];
  /** Allow signed-out callers (public forms). */
  public?: boolean;
  rateLimit?: RateLimitKey;
  flag?: FlagKey;
};

type Ctx = { user: SessionUser };
type PublicCtx = { user: SessionUser | null };

export function toActionError(err: unknown): ActionError {
  if (err instanceof AppError) return { code: err.code, message: err.message, fieldErrors: err.fieldErrors };
  if (err instanceof DbNotConfiguredError) return { code: "db_not_configured" };
  if (err instanceof z.ZodError) return { code: "validation", fieldErrors: zodFieldErrors(err) };
  console.error("[action] unexpected error", err);
  return { code: "internal" };
}

export function zodFieldErrors(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * The one way to write a mutation. Validates input with zod, authenticates,
 * checks role / feature flag / rate limit, and converts thrown AppErrors into
 * a typed result the UI can render. Usage (in a "use server" file):
 *
 *   export const grantAccess = action(
 *     { input: grantSchema, roles: ["admin"] },
 *     async (input, { user }) => { ... return { id } },
 *   );
 */
export function action<S extends z.ZodType, T>(
  opts: Options<S> & { public: true },
  handler: (input: z.output<S>, ctx: PublicCtx) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>>;
export function action<S extends z.ZodType, T>(
  opts: Options<S>,
  handler: (input: z.output<S>, ctx: Ctx) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>>;
export function action<S extends z.ZodType, T>(
  opts: Options<S>,
  handler: (input: z.output<S>, ctx: Ctx & PublicCtx) => Promise<T>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const parsed = opts.input.safeParse(raw);
      if (!parsed.success) return { ok: false, error: { code: "validation", fieldErrors: zodFieldErrors(parsed.error) } };

      let user: SessionUser | null = null;
      if (opts.public) {
        user = await requireUser().catch(() => null);
      } else {
        user = opts.roles?.length ? await requireRole(...opts.roles) : await requireUser();
      }
      if (opts.flag) await requireFlag(opts.flag, user);
      if (opts.rateLimit) await enforceRateLimit(opts.rateLimit, user?.id ?? "anon", user?.role);

      const data = await handler(parsed.data, { user } as Ctx & PublicCtx);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: toActionError(err) };
    }
  };
}

/** Same guarantees for route handlers (JSON APIs, streaming endpoints). */
export function apiError(err: unknown): Response {
  const e = toActionError(err);
  const status: Record<ErrorCode, number> = {
    unauthorized: 401,
    forbidden: 403,
    not_found: 404,
    validation: 422,
    conflict: 409,
    rate_limited: 429,
    no_access: 402,
    feature_disabled: 403,
    db_not_configured: 503,
    integration_not_configured: 503,
    internal: 500,
  };
  return Response.json({ ok: false, error: e }, { status: status[e.code] });
}
