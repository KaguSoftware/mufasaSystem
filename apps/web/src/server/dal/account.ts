import "server-only";
import { z } from "zod";
import { eq, getDb, schema } from "@mufasa/db";
import { AppError, forbidden } from "../errors";
import type { SessionUser } from "../session";

export const updateAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  locale: z.enum(["en", "ar", "tr"]),
  timezone: z.string().min(1).max(64),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateAccount(actor: SessionUser, input: UpdateAccountInput): Promise<void> {
  const data = updateAccountSchema.parse(input);
  if (!validTimezone(data.timezone)) throw new AppError("validation", "timezone", { timezone: ["invalid"] });
  const db = getDb();
  await db.transaction(async (tx) => {
    // Managed children: the parent controls the display name.
    const name = actor.isManagedChild ? undefined : data.displayName;
    await tx
      .update(schema.user)
      .set({ locale: data.locale, timezone: data.timezone, ...(name ? { name } : {}) })
      .where(eq(schema.user.id, actor.id));
    if (!actor.isManagedChild) {
      await tx
        .insert(schema.profiles)
        .values({ userId: actor.id, displayName: data.displayName })
        .onConflictDoUpdate({ target: schema.profiles.userId, set: { displayName: data.displayName } });
    }
  });
}

export async function getAccountView(actor: SessionUser) {
  const db = getDb();
  const [u, profile] = await Promise.all([
    db.query.user.findFirst({ where: eq(schema.user.id, actor.id), columns: { twoFactorEnabled: true } }),
    db.query.profiles.findFirst({ where: eq(schema.profiles.userId, actor.id), columns: { displayName: true, birthYear: true } }),
  ]);
  return {
    displayName: profile?.displayName ?? actor.name,
    birthYear: profile?.birthYear ?? null,
    twoFactorEnabled: Boolean(u?.twoFactorEnabled),
  };
}

/** True when this session was created by an admin impersonating the user. */
export async function isImpersonating(sessionId: string): Promise<boolean> {
  const row = await getDb().query.session.findFirst({ where: eq(schema.session.id, sessionId), columns: { impersonatedBy: true } });
  return Boolean(row?.impersonatedBy);
}

export async function assertImpersonating(sessionId: string): Promise<void> {
  if (!(await isImpersonating(sessionId))) throw forbidden();
}
