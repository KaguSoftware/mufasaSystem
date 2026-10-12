/** Pure validation for homework attachments (images, PDFs, audio). */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
};

export type AttachmentCheck = { ok: true; mime: string; ext: string } | { ok: false; reason: "type" | "size" | "empty" };

export function checkAttachment(file: { type: string; size: number }): AttachmentCheck {
  if (file.size <= 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, reason: "size" };
  const mime = file.type.split(";")[0]!.trim().toLowerCase();
  const ext = EXT_BY_MIME[mime];
  return ext ? { ok: true, mime, ext } : { ok: false, reason: "type" };
}
