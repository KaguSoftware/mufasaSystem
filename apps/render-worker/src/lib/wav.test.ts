import { describe, expect, it } from "vitest";
import { DEFAULT_PCM, parsePcmMime, pcmDurationSec, pcmToWav } from "./wav";

describe("wav", () => {
  it("parses gemini pcm mime types", () => {
    expect(parsePcmMime("audio/L16;codec=pcm;rate=24000")).toEqual({ sampleRate: 24000, channels: 1, bitsPerSample: 16 });
    expect(parsePcmMime("audio/L16;rate=16000").sampleRate).toBe(16000);
    expect(parsePcmMime(undefined)).toEqual(DEFAULT_PCM);
  });

  it("computes duration from sample count", () => {
    expect(pcmDurationSec(48000)).toBeCloseTo(1, 5); // 24000 samples * 2 bytes
    expect(pcmDurationSec(48000 * 2.5)).toBeCloseTo(2.5, 5);
  });

  it("writes a valid RIFF header", () => {
    const pcm = new Uint8Array(480);
    const wav = pcmToWav(pcm);
    expect(wav.length).toBe(44 + 480);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(4)).toBe(36 + 480);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(28)).toBe(48000);
    expect(wav.readUInt32LE(40)).toBe(480);
  });
});
