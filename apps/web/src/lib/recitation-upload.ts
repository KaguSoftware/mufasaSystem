/** Pure validation helpers for recitation audio uploads. */

export const MAX_RECITATION_BYTES = 25 * 1024 * 1024;
export const MAX_RECITATION_SECONDS = 10 * 60;

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
};

/** "audio/webm;codecs=opus" becomes "audio/webm". */
export function baseMime(mime: string): string {
  return mime.split(";")[0]!.trim().toLowerCase();
}

export function extensionForMime(mime: string): string | null {
  return EXT_BY_MIME[baseMime(mime)] ?? null;
}

export type UploadCheck = { ok: true; mime: string; ext: string } | { ok: false; reason: "type" | "size" | "empty" };

export function checkRecitationFile(file: { type: string; size: number }): UploadCheck {
  if (file.size <= 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_RECITATION_BYTES) return { ok: false, reason: "size" };
  const ext = extensionForMime(file.type);
  if (!ext) return { ok: false, reason: "type" };
  return { ok: true, mime: baseMime(file.type), ext };
}

/** Best MediaRecorder mime for this browser (webm/opus first, mp4 for Safari). */
export function pickRecorderMime(isSupported: (mime: string) => boolean): string | null {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((m) => isSupported(m)) ?? null;
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
