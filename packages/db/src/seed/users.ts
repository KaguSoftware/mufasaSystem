import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { account, parentalConsents, parentChildren, profiles, tutorProfiles, user, type Role } from "../schema";

export const DEMO_PASSWORD = "Demo1234!";
export const KID_USERNAME = "kid1";
export const KID_PIN = "123456";

type DemoUser = { email: string; name: string; role: Role; displayName: string; birthYear: number | null };

const DEMO_USERS: DemoUser[] = [
  { email: "admin@demo.local", name: "Demo Admin", role: "admin", displayName: "Admin", birthYear: 1985 },
  { email: "tutor@demo.local", name: "Demo Tutor", role: "tutor", displayName: "Tutor", birthYear: 1990 },
  { email: "parent@demo.local", name: "Demo Parent", role: "parent", displayName: "Parent", birthYear: 1986 },
  { email: "student@demo.local", name: "Demo Student", role: "student", displayName: "Student", birthYear: 2008 },
];

async function insertCredentialUser(
  db: Db,
  u: {
    id: string;
    email: string;
    name: string;
    role: Role;
    password: string;
    username?: string;
    isManagedChild?: boolean;
    displayName: string;
    birthYear: number | null;
  },
) {
  const hash = await hashPassword(u.password);
  await db.insert(user).values({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: true,
    role: u.role,
    username: u.username ?? null,
    displayUsername: u.username ?? null,
    isManagedChild: u.isManagedChild ?? false,
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: u.id,
    providerId: "credential",
    userId: u.id,
    password: hash,
  });
  await db.insert(profiles).values({ userId: u.id, displayName: u.displayName, birthYear: u.birthYear });
}

/** Idempotent: users are looked up by email / username and only created when missing. */
export async function seedUsers(db: Db) {
  const ids = new Map<string, string>();

  for (const d of DEMO_USERS) {
    const existing = await db.query.user.findFirst({ where: eq(user.email, d.email), columns: { id: true } });
    if (existing) {
      ids.set(d.role, existing.id);
      continue;
    }
    const id = randomUUID();
    await insertCredentialUser(db, { id, ...d, password: DEMO_PASSWORD });
    if (d.role === "tutor") {
      await db.insert(tutorProfiles).values({
        userId: id,
        headline: "Quran and Arabic tutor",
        bio: "Demo tutor account for local development.",
        languages: ["en", "ar", "tr"],
        specialties: ["tajweed", "arabic-basics"],
      });
    }
    ids.set(d.role, id);
    console.log(`  created ${d.email}`);
  }

  // Managed child: logs in with username + PIN, linked to the demo parent.
  const parentId = ids.get("parent")!;
  let kid = await db.query.user.findFirst({ where: eq(user.username, KID_USERNAME), columns: { id: true } });
  if (!kid) {
    const id = randomUUID();
    await insertCredentialUser(db, {
      id,
      email: `${id}@kids.invalid`,
      name: "Kid",
      role: "student",
      password: KID_PIN,
      username: KID_USERNAME,
      isManagedChild: true,
      displayName: "Kid",
      birthYear: new Date().getFullYear() - 8,
    });
    kid = { id };
    console.log(`  created managed child ${KID_USERNAME}`);
  }
  await db.insert(parentChildren).values({ parentId, childId: kid.id, relation: "parent" }).onConflictDoNothing();
  const consent = await db.query.parentalConsents.findFirst({
    where: eq(parentalConsents.childId, kid.id),
    columns: { id: true },
  });
  if (!consent) {
    await db.insert(parentalConsents).values({
      parentId,
      childId: kid.id,
      policyVersion: "2026-10-01",
      allowLiveVideo: true,
      allowRecitationRecording: true,
      allowAiFeedback: true,
      allowSessionRecording: false,
    });
  }
  console.log(`  users ready (password ${DEMO_PASSWORD}, kid PIN ${KID_PIN})`);
}
