import "server-only";
import { isDbConfigured } from "@mufasa/db";
import { requireUser, type SessionUser } from "@/server/session";

/**
 * For panel pages: returns the signed-in user, or null when the database is not
 * configured (PanelGate then shows its notice and the page renders only its header).
 */
export async function pageUser(): Promise<SessionUser | null> {
  if (!isDbConfigured()) return null;
  return requireUser();
}
