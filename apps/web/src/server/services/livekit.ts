import "server-only";
import { AccessToken, RoomServiceClient, TrackSource, TrackType, WebhookReceiver } from "livekit-server-sdk";
import { env, isConfigured } from "@/env";
import { AppError } from "../errors";

function requireLivekit() {
  if (!isConfigured("livekit")) throw new AppError("integration_not_configured", "LiveKit");
  const e = env();
  return { url: e.LIVEKIT_URL!, key: e.LIVEKIT_API_KEY!, secret: e.LIVEKIT_API_SECRET! };
}

/** Browser clients connect over WebSocket. */
export function livekitWsUrl(): string {
  return requireLivekit().url.replace(/^http/, "ws");
}

/** Server API calls use HTTP(S). */
function livekitHttpUrl(): string {
  return requireLivekit().url.replace(/^ws/, "http");
}

export type LiveRole = "tutor" | "student";

/**
 * Mints a LiveKit join token.
 * - tutor: roomAdmin + publish (all sources incl. screen share) + publishData + subscribe
 * - student: publish camera and microphone only (no screen share) + publishData (raise hand) + subscribe
 * Identity is the user id; `name` must already be a first name only for minors.
 */
export async function mintToken(opts: {
  identity: string;
  name: string;
  room: string;
  role: LiveRole;
  metadata?: Record<string, unknown>;
  ttlSeconds: number;
}): Promise<{ token: string; url: string }> {
  const { key, secret } = requireLivekit();
  const at = new AccessToken(key, secret, {
    identity: opts.identity,
    name: opts.name,
    ttl: opts.ttlSeconds,
    metadata: JSON.stringify({ role: opts.role, ...opts.metadata }),
  });
  at.addGrant(
    opts.role === "tutor"
      ? {
          roomJoin: true,
          room: opts.room,
          roomAdmin: true,
          canPublish: true,
          canPublishData: true,
          canSubscribe: true,
        }
      : {
          roomJoin: true,
          room: opts.room,
          canPublish: true,
          canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
          canPublishData: true,
          canSubscribe: true,
        },
  );
  return { token: await at.toJwt(), url: livekitWsUrl() };
}

export function roomService(): RoomServiceClient {
  const { key, secret } = requireLivekit();
  return new RoomServiceClient(livekitHttpUrl(), key, secret);
}

/** Mutes every published audio track of everyone except `exceptIdentity` (the tutor). Returns how many were muted. */
export async function muteAllAudio(room: string, exceptIdentity: string): Promise<number> {
  const svc = roomService();
  const participants = await svc.listParticipants(room);
  let muted = 0;
  for (const p of participants) {
    if (p.identity === exceptIdentity) continue;
    for (const track of p.tracks) {
      if (track.type === TrackType.AUDIO && !track.muted) {
        await svc.mutePublishedTrack(room, p.identity, track.sid, true);
        muted++;
      }
    }
  }
  return muted;
}

export async function removeParticipant(room: string, identity: string): Promise<void> {
  await roomService().removeParticipant(room, identity);
}

/** Verifies the signature (raw body + Authorization header) and parses the event. Throws when invalid. */
export async function receiveWebhook(rawBody: string, authHeader: string | null) {
  const { key, secret } = requireLivekit();
  return new WebhookReceiver(key, secret).receive(rawBody, authHeader ?? undefined);
}
