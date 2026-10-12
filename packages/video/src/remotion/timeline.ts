/**
 * Pure helpers shared by the renderer components and tests: scene offsets,
 * persistence of board content across scenes, erase timing and element boxes.
 */
import { sceneDuration, VIDEO, type BoardAction, type SceneDocument } from "../schema";

export const FRAME = { w: VIDEO.width, h: VIDEO.height } as const;

export const SIZE_PX = { sm: 40, md: 58, lg: 84, xl: 116, xxl: 156 } as const;

export type Box = { x: number; y: number; w: number; h: number };

/** Frames per scene and their start frame. */
export function sceneLayout(doc: SceneDocument): { from: number; frames: number }[] {
  let from = 0;
  return doc.scenes.map((s) => {
    const frames = Math.max(1, Math.round(sceneDuration(s) * VIDEO.fps));
    const out = { from, frames };
    from += frames;
    return out;
  });
}

export function isArabicText(s: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(s);
}

export function resolveDir(dir: "rtl" | "ltr" | "auto", text: string): "rtl" | "ltr" {
  return dir === "auto" ? (isArabicText(text) ? "rtl" : "ltr") : dir;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function progress(tSec: number, at: number, dur: number): number {
  return clamp01((tSec - at) / Math.max(0.05, dur));
}

type Drawable = Exclude<BoardAction, { type: "highlight" } | { type: "erase" }>;

export function isDrawable(a: BoardAction): a is Drawable {
  return a.type !== "highlight" && a.type !== "erase";
}

export function defaultDuration(a: BoardAction): number {
  if ("durationSec" in a && a.durationSec) return a.durationSec;
  switch (a.type) {
    case "write":
      return Math.max(0.8, Math.min(6, a.text.length * 0.09));
    case "ayah":
      return Math.max(1.2, Math.min(4, a.text.length * 0.03));
    case "letter":
      return a.showForms ? 2.4 : 1;
    case "draw":
      return a.shape === "check" || a.shape === "cross" ? 0.6 : 0.9;
    case "image":
      return 0.6;
    case "highlight":
      return 0.8;
    case "erase":
      return 0.5;
  }
}

/** Seconds at which `action` is erased within its scene, or null if never. */
export function eraseTime(action: BoardAction, actions: readonly BoardAction[]): number | null {
  if (!isDrawable(action)) return null;
  let best: number | null = null;
  for (const e of actions) {
    if (e.type !== "erase" || e.at < action.at) continue;
    if (e.targetId && e.targetId !== action.id) continue;
    if (best === null || e.at < best) best = e.at;
  }
  return best;
}

/**
 * Board content that stays on screen from earlier scenes (until a scene that
 * clears the board). Returned as already-complete drawables (at = -1000).
 */
export function carryOver(doc: SceneDocument, sceneIndex: number): BoardAction[] {
  let start = 0;
  for (let i = sceneIndex; i >= 0; i--) {
    if (doc.scenes[i]?.clearBoardBefore) {
      start = i;
      break;
    }
  }
  let items: Drawable[] = [];
  for (let i = start; i < sceneIndex; i++) {
    const scene = doc.scenes[i]!;
    if (scene.clearBoardBefore) items = [];
    for (const a of [...scene.actions].sort((x, y) => x.at - y.at)) {
      if (isDrawable(a)) items.push(a);
      else if (a.type === "erase") items = a.targetId ? items.filter((d) => d.id !== a.targetId) : [];
    }
  }
  return items.map((d) => ({ ...d, at: -1000, durationSec: 0.1 }) as BoardAction);
}

const pxW = (px: number) => (px / FRAME.w) * 100;
const pxH = (px: number) => (px / FRAME.h) * 100;

/** Approximate on-board box (percent, top-left based) used by highlights. */
export function actionBox(a: BoardAction): Box | null {
  switch (a.type) {
    case "write": {
      const px = SIZE_PX[a.size];
      const factor = isArabicText(a.text) ? 0.5 : 0.52;
      const w = Math.min(90, pxW(a.text.length * px * factor));
      const lines = Math.max(1, Math.ceil(pxW(a.text.length * px * factor) / 90));
      const h = pxH(px * 1.45 * lines);
      const dir = resolveDir(a.dir, a.text);
      let left = a.x - w / 2;
      if (a.align !== "center") {
        const anchoredLeft = (a.align === "start") === (dir === "ltr");
        left = anchoredLeft ? a.x : a.x - w;
      }
      return { x: left, y: a.y - h / 2, w, h };
    }
    case "ayah": {
      const px = SIZE_PX[a.size];
      const total = pxW(a.text.length * px * 0.42);
      const w = Math.min(80, Math.max(12, total));
      const lines = Math.max(1, Math.ceil(total / 80));
      const h = pxH(px * 1.9 * lines);
      return { x: a.x - w / 2, y: a.y - h / 2, w, h };
    }
    case "letter": {
      const w = a.showForms ? pxW(860) : pxW(300);
      const h = a.showForms ? pxH(360) : pxH(300);
      return { x: a.x - w / 2, y: a.y - h / 2, w, h };
    }
    case "draw":
    case "image":
      return { x: a.x, y: a.y, w: a.w, h: a.h };
    default:
      return null;
  }
}
