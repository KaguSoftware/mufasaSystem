import "server-only";
import { z } from "zod";
import { eq, getDb, schema, sql } from "@mufasa/db";
import { MIN_SELF_SIGNUP_AGE, SIGNUP_ROLE_WINDOW_MS } from "@/lib/policy";
import { canSelfSignup, isPlausibleBirthYear } from "@/lib/minor";
import { AppError, forbidden } from "../errors";
import type { SessionUser } from "../session";

export const completeSignupSchema = z.object({
  role: z.enum(["parent", "student"]),
  displayName: z.string().trim().min(1).max(60).optional(),
  birthYear: z.number().int().optional(),
  locale: z.enum(["en", "ar", "tr"]).optional(),
});
export type CompleteSignupInput = z.infer<typeof completeSignupSchema>;

/**
 * Called right after sign-up (and from onboarding for social sign-ins).
 * Sets the role to parent or student ONLY when ALL of these hold:
 *  - the current role is the default `student` (so staff accounts can never be changed here)
 *  - the account is not a managed child
 *  - the account is younger than 10 minutes
 *  - no profile exists yet (an admin-prepared account always has one)
 * Never allows tutor or admin (the zod enum rejects them).
 */
export async function completeSignup(actor: SessionUser, input: CompleteSignupInput): Promise<{ role: "parent" | "student" }> {
  const data = completeSignupSchema.parse(input);
  const db = getDb();
  const row = await db.query.user.findFirst({ where: eq(schema.user.id, actor.id) });
  if (!row) throw forbidden();
  const hasProfile = await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, actor.id), columns: { userId: true } });
  if (hasProfile) throw new AppError("conflict", "already_completed");
  if (row.role !== "student" || row.isManagedChild) throw forbidden();
  if (Date.now() - row.createdAt.getTime() > SIGNUP_ROLE_WINDOW_MS) throw forbidden();

  if (data.role === "student") {
    if (data.birthYear === undefined || !isPlausibleBirthYear(data.birthYear)) {
      throw new AppError("validation", "birthYear", { birthYear: ["invalid"] });
    }
    if (!canSelfSignup(data.birthYear, MIN_SELF_SIGNUP_AGE)) {
      // Under 13: a parent must create the account. Remove the just-created account (no data kept).
      await db.delete(schema.user).where(eq(schema.user.id, actor.id));
      throw new AppError("validation", "under_age", { birthYear: ["under_age"] });
    }
  }

  const displayName = (data.displayName ?? row.name).trim() || row.name;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.user)
      .set({ role: data.role, ...(data.locale ? { locale: data.locale } : {}) })
      .where(eq(schema.user.id, actor.id));
    await tx
      .insert(schema.profiles)
      .values({ userId: actor.id, displayName, birthYear: data.role === "student" ? data.birthYear : null })
      .onConflictDoNothing();
  });
  return { role: data.role };
}

/** Student onboarding: confirm display name and birth year. */
export async function updateOwnProfile(
  actor: SessionUser,
  input: { displayName: string; birthYear?: number | null },
): Promise<void> {
  const db = getDb();
  if (input.birthYear != null && !canSelfSignup(input.birthYear, MIN_SELF_SIGNUP_AGE)) {
    throw new AppError("validation", "birthYear", { birthYear: ["invalid"] });
  }
  await db
    .insert(schema.profiles)
    .values({ userId: actor.id, displayName: input.displayName, birthYear: input.birthYear ?? null })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        displayName: input.displayName,
        // A birth year can be set once; later changes go through an admin (it drives child-safety rules).
        ...(input.birthYear != null && !actor.isManagedChild
          ? { birthYear: sql`coalesce(${schema.profiles.birthYear}, ${input.birthYear})` }
          : {}),
      },
    });
}
