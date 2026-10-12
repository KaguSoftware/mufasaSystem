import "server-only";
import { and, asc, eq, getDb, isDbConfigured, schema } from "@mufasa/db";
import { brand } from "@mufasa/config/brand";
import { getPublicSettings } from "./settings";

/**
 * Public (anonymous) reads for the marketing site. Every function degrades to an
 * empty result when the database is not configured or unreachable, so public
 * pages always render.
 */

/** Runs a DB read and returns `fallback` when no DB is configured or the query fails. */
export async function safePublic<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDbConfigured()) return fallback;
  try {
    return await read();
  } catch {
    return fallback;
  }
}

export type SiteContact = { whatsapp: string; email: string };

/** WhatsApp number (digits only) and support email, with brand fallbacks. */
export async function getSiteContact(): Promise<SiteContact> {
  try {
    const s = await getPublicSettings();
    return {
      whatsapp: s["contact.whatsapp"] || brand.whatsappNumber,
      email: s["contact.email"] || brand.supportEmail,
    };
  } catch {
    return { whatsapp: brand.whatsappNumber, email: brand.supportEmail };
  }
}

export type PublicTutor = {
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  languages: string[];
  specialties: string[];
};

/** Tutors who opted in to a public profile. No email, no contact details. */
export async function listPublicTutors(): Promise<PublicTutor[]> {
  return safePublic(async () => {
    const rows = await getDb()
      .select({
        userId: schema.tutorProfiles.userId,
        name: schema.user.name,
        displayName: schema.profiles.displayName,
        headline: schema.tutorProfiles.headline,
        bio: schema.tutorProfiles.bio,
        languages: schema.tutorProfiles.languages,
        specialties: schema.tutorProfiles.specialties,
      })
      .from(schema.tutorProfiles)
      .innerJoin(schema.user, eq(schema.user.id, schema.tutorProfiles.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.tutorProfiles.userId))
      .where(and(eq(schema.tutorProfiles.isPublic, true), eq(schema.user.role, "tutor")))
      .orderBy(asc(schema.user.name));
    return rows
      .filter((r) => r.headline || r.bio)
      .map((r) => ({
        userId: r.userId,
        displayName: r.displayName || r.name,
        headline: r.headline,
        bio: r.bio,
        languages: r.languages,
        specialties: r.specialties,
      }));
  }, []);
}
