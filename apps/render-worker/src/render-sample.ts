/**
 * Offline smoke test of the whole Remotion pipeline: renders the fixture scene
 * document silently to render-output/sample.mp4. No database, Gemini or storage.
 *
 *   pnpm --filter render-worker render:sample
 *
 * The first run downloads a headless Chrome shell (Remotion does it automatically).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sceneDocumentSchema } from "@mufasa/video/schema";
import { renderWhiteboard } from "./lib/render";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../../../packages/video/src/fixtures/sample-scene.json");
const outDir = path.resolve(here, "../render-output");
const outFile = path.join(outDir, "sample.mp4");

async function main() {
  const doc = sceneDocumentSchema.parse(JSON.parse(await fs.readFile(fixture, "utf8")));
  await fs.mkdir(outDir, { recursive: true });
  const started = Date.now();
  let shown = -1;
  const res = await renderWhiteboard({
    input: { doc, audio: {}, assets: { mascotPoses: {} } },
    outputLocation: outFile,
    log: console.log,
    onProgress: (pct) => {
      const p = Math.floor(pct / 10) * 10;
      if (p !== shown) {
        shown = p;
        console.log(`render ${p}%`);
      }
    },
  });
  const stat = await fs.stat(outFile);
  console.log(
    `done: ${outFile} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${res.durationSec.toFixed(1)}s video, rendered in ${((Date.now() - started) / 1000).toFixed(0)}s)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
