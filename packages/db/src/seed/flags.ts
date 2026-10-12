import type { Db } from "../client";
import { featureFlags } from "../schema";

/**
 * Keep in sync with FLAG_DEFAULTS in apps/web/src/server/flags.ts (copied, not
 * imported: packages never import from apps). Rows are only inserted when
 * missing, so an admin's toggles survive re-seeding.
 */
const FLAGS = [
  { key: "ai_studio", enabled: true, description: "AI script chat + whiteboard video generation" },
  { key: "ai_recitation_feedback", enabled: true, description: "Gemini feedback on uploaded recitations" },
  { key: "live_video", enabled: true, description: "Built-in LiveKit classrooms (else external links only)" },
  { key: "iyzico_checkout", enabled: false, description: "Online card payments via iyzico" },
  { key: "manual_payments", enabled: true, description: "IBAN / WhatsApp payment with receipt upload" },
  { key: "placement_test", enabled: true, description: "Placement test during onboarding" },
  { key: "gamification", enabled: true, description: "XP, streaks and badges" },
  { key: "certificates", enabled: true, description: "Auto-issued PDF certificates" },
  { key: "parent_messaging", enabled: true, description: "Parent and tutor message threads" },
];

export async function seedFlags(db: Db) {
  await db.insert(featureFlags).values(FLAGS).onConflictDoNothing();
  console.log(`  flags: ${FLAGS.length}`);
}
