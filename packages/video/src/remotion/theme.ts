import type { BOARD_COLORS } from "../schema";

export type BoardColor = (typeof BOARD_COLORS)[number];
export type BoardKind = "whiteboard" | "chalkboard" | "grid";

export const BRAND = { teal: "#0f766e", tealDark: "#115e59", amber: "#f59e0b", amberLight: "#fde9b8" } as const;

const LIGHT: Record<BoardColor, string> = {
  ink: "#1f2937",
  blue: "#2563eb",
  red: "#dc2626",
  green: "#16a34a",
  orange: "#ea580c",
  purple: "#7c3aed",
};
const CHALK: Record<BoardColor, string> = {
  ink: "#f4f4ef",
  blue: "#7dd3fc",
  red: "#fca5a5",
  green: "#86efac",
  orange: "#fdba74",
  purple: "#c4b5fd",
};

export function inkColor(board: BoardKind, c: BoardColor): string {
  return (board === "chalkboard" ? CHALK : LIGHT)[c];
}

export const BOARD_BG: Record<BoardKind, string> = {
  whiteboard: "#fbfaf6",
  chalkboard: "#1f3d36",
  grid: "#ffffff",
};
