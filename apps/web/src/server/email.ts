import "server-only";
import { env, isConfigured } from "@/env";

export type EmailMessage = { to: string; subject: string; html: string; text?: string };

/**
 * Sends a transactional email through Resend. When RESEND_API_KEY is missing
 * (local dev, before accounts exist) the email is logged instead of sent.
 * Uses the REST API directly to avoid an SDK dependency.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ id?: string; skipped?: boolean }> {
  if (msg.to.endsWith("@kids.invalid")) return { skipped: true }; // managed child accounts have no inbox
  if (!isConfigured("email")) {
    console.info(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text ?? msg.html}`);
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env().EMAIL_FROM, ...msg }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string };
}
