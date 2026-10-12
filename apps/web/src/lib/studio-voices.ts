/** Client-safe constants shared by the AI Studio UI, actions and prompts (no server imports here). */

/**
 * Gemini TTS prebuilt voices (documented at ai.google.dev/gemini-api/docs/speech-generation;
 * the SDK typings only say `voiceName` is a string, e.g. Puck or Charon).
 */
export const STUDIO_VOICES = [
  { id: "Kore", style: "firm" },
  { id: "Sulafat", style: "warm" },
  { id: "Achird", style: "friendly" },
  { id: "Aoede", style: "breezy" },
  { id: "Leda", style: "youthful" },
  { id: "Puck", style: "upbeat" },
  { id: "Zephyr", style: "bright" },
  { id: "Charon", style: "informative" },
  { id: "Fenrir", style: "excitable" },
  { id: "Orus", style: "firm" },
  { id: "Callirrhoe", style: "easy-going" },
  { id: "Autonoe", style: "bright" },
  { id: "Enceladus", style: "breathy" },
  { id: "Iapetus", style: "clear" },
  { id: "Umbriel", style: "easy-going" },
  { id: "Algieba", style: "smooth" },
  { id: "Despina", style: "smooth" },
  { id: "Erinome", style: "clear" },
  { id: "Algenib", style: "gravelly" },
  { id: "Rasalgethi", style: "informative" },
  { id: "Laomedeia", style: "upbeat" },
  { id: "Achernar", style: "soft" },
  { id: "Alnilam", style: "firm" },
  { id: "Schedar", style: "even" },
  { id: "Gacrux", style: "mature" },
  { id: "Pulcherrima", style: "forward" },
  { id: "Zubenelgenubi", style: "casual" },
  { id: "Vindemiatrix", style: "gentle" },
  { id: "Sadachbia", style: "lively" },
  { id: "Sadaltager", style: "knowledgeable" },
] as const;

export type StudioVoice = (typeof STUDIO_VOICES)[number]["id"];

export const DEFAULT_VOICE_BY_LOCALE: Record<"ar" | "en" | "tr", StudioVoice> = {
  ar: "Kore",
  en: "Leda",
  tr: "Aoede",
};

export function isStudioVoice(v: string): v is StudioVoice {
  return STUDIO_VOICES.some((x) => x.id === v);
}


export type AgeBand = "5-8" | "9-12" | "13-17";
export const AGE_BANDS: readonly AgeBand[] = ["5-8", "9-12", "13-17"];

