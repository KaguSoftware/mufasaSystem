/**
 * Remotion rendering, free of database / Gemini / storage so `render:sample`
 * can use it offline. The bundle is built once per process and cached.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { VIDEO, type SceneDocument } from "@mufasa/video/schema";

const here = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO_ENTRY = path.resolve(here, "../../../../packages/video/src/remotion/index.ts");
export const COMPOSITION_ID = "Whiteboard";

let bundlePromise: Promise<string> | null = null;

export function getServeUrl(onProgress?: (pct: number) => void): Promise<string> {
  bundlePromise ??= bundle({ entryPoint: VIDEO_ENTRY, onProgress: (p) => onProgress?.(p) }).catch((err) => {
    bundlePromise = null; // allow a retry after a failed bundle
    throw err;
  });
  return bundlePromise;
}

export type RenderInput = {
  doc: SceneDocument;
  audio: Record<string, { src: string; durationSec: number }>;
  assets: { mascotPoses: Record<string, string> };
};

export async function renderWhiteboard(opts: {
  input: RenderInput;
  outputLocation: string;
  /** 0..100 across bundling and rendering. */
  onProgress?: (pct: number) => void;
  log?: (...args: unknown[]) => void;
}): Promise<{ durationInFrames: number; durationSec: number }> {
  const { input, outputLocation, onProgress, log } = opts;
  const serveUrl = await getServeUrl((p) => onProgress?.(p * 0.15));
  onProgress?.(15);
  const inputProps = input as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  log?.(`composition ${composition.id}: ${composition.durationInFrames} frames @ ${composition.fps}fps`);
  let last = 0;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = 15 + progress * 85;
      if (pct - last >= 2) {
        last = pct;
        onProgress?.(pct);
      }
    },
  });
  return {
    durationInFrames: composition.durationInFrames,
    durationSec: composition.durationInFrames / (composition.fps || VIDEO.fps),
  };
}
