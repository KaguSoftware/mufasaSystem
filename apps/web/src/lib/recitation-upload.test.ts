import { describe, expect, it } from "vitest";
import { MAX_RECITATION_BYTES, checkRecitationFile, extensionForMime, formatDuration, pickRecorderMime } from "./recitation-upload";

describe("checkRecitationFile", () => {
  it("accepts audio with codecs parameters", () => {
    expect(checkRecitationFile({ type: "audio/webm;codecs=opus", size: 1000 })).toEqual({ ok: true, mime: "audio/webm", ext: "webm" });
    expect(checkRecitationFile({ type: "audio/mp4", size: 10 })).toMatchObject({ ok: true, ext: "m4a" });
  });
  it("rejects wrong type, empty and oversize files", () => {
    expect(checkRecitationFile({ type: "image/png", size: 10 })).toEqual({ ok: false, reason: "type" });
    expect(checkRecitationFile({ type: "audio/webm", size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(checkRecitationFile({ type: "audio/webm", size: MAX_RECITATION_BYTES + 1 })).toEqual({ ok: false, reason: "size" });
  });
  it("maps extensions", () => {
    expect(extensionForMime("audio/mpeg")).toBe("mp3");
    expect(extensionForMime("text/plain")).toBeNull();
  });
});

describe("recorder helpers", () => {
  it("prefers webm then falls back to mp4", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime(() => false)).toBeNull();
  });
  it("formats durations", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
  });
});
