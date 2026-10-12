/** Minimal WAV helpers for Gemini TTS output (raw 16-bit little-endian PCM). Pure and unit tested. */

export type PcmFormat = { sampleRate: number; channels: number; bitsPerSample: number };

export const DEFAULT_PCM: PcmFormat = { sampleRate: 24000, channels: 1, bitsPerSample: 16 };

/** Parses e.g. "audio/L16;codec=pcm;rate=24000". Unknown parts fall back to Gemini TTS defaults. */
export function parsePcmMime(mime: string | undefined): PcmFormat {
  const out = { ...DEFAULT_PCM };
  if (!mime) return out;
  const rate = /rate=(\d+)/i.exec(mime);
  if (rate) out.sampleRate = Number(rate[1]);
  const channels = /channels=(\d+)/i.exec(mime);
  if (channels) out.channels = Number(channels[1]);
  const bits = /L(\d+)/i.exec(mime);
  if (bits) out.bitsPerSample = Number(bits[1]);
  return out;
}

export function pcmDurationSec(byteLength: number, fmt: PcmFormat = DEFAULT_PCM): number {
  const bytesPerSample = fmt.bitsPerSample / 8;
  return byteLength / (fmt.sampleRate * fmt.channels * bytesPerSample);
}

/** Wraps raw PCM in a 44-byte RIFF/WAVE header. */
export function pcmToWav(pcm: Uint8Array, fmt: PcmFormat = DEFAULT_PCM): Buffer {
  const byteRate = (fmt.sampleRate * fmt.channels * fmt.bitsPerSample) / 8;
  const blockAlign = (fmt.channels * fmt.bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(fmt.channels, 22);
  header.writeUInt32LE(fmt.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(fmt.bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]);
}
