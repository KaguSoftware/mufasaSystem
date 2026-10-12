import { loadFont as loadNaskh } from "@remotion/google-fonts/NotoNaskhArabic";
import { loadFont as loadKufi } from "@remotion/google-fonts/NotoKufiArabic";
import { loadFont as loadHand } from "@remotion/google-fonts/Caveat";

let started = false;

/** Idempotent; called from the composition body so importing this package has no side effects. */
export function ensureFonts() {
  if (started) return;
  started = true;
  const safe = (fn: () => { waitUntilDone: () => Promise<undefined> }) => {
    try {
      void fn()
        .waitUntilDone()
        .catch(() => undefined);
    } catch {
      // Offline or blocked: the CSS fallback stacks below keep text readable.
    }
  };
  safe(() => loadNaskh("normal", { weights: ["500", "700"], subsets: ["arabic", "latin"] }));
  safe(() => loadKufi("normal", { weights: ["500", "700"], subsets: ["arabic", "latin"] }));
  safe(() => loadHand("normal", { weights: ["600"], subsets: ["latin", "latin-ext"] }));
}

export const FONT_STACK = {
  naskh: "'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', serif",
  sans: "'Noto Kufi Arabic', 'Segoe UI', Tahoma, sans-serif",
  hand: "'Caveat', 'Noto Naskh Arabic', 'Segoe Print', cursive",
} as const;
