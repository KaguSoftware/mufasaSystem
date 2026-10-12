import React from "react";
import type { CSSProperties } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BoardAction } from "../schema";
import { FORM_LABELS, letterForms } from "../letter-forms";
import { AssetArt } from "./assets";
import { FONT_STACK } from "./fonts";
import { shapePath } from "./shapes";
import { inkColor, type BoardKind } from "./theme";
import {
  actionBox,
  clamp01,
  defaultDuration,
  easeInOut,
  eraseTime,
  FRAME,
  isDrawable,
  progress,
  resolveDir,
  SIZE_PX,
} from "./timeline";

type Locale = "ar" | "en" | "tr";
type Ctx = { board: BoardKind; locale: Locale; all: readonly BoardAction[] };

function useSeconds() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, t: frame / fps };
}

/** Opacity after an `erase` action targets this element. */
function eraseOpacity(a: BoardAction, ctx: Ctx, t: number): number {
  const e = eraseTime(a, ctx.all);
  return e === null ? 1 : 1 - clamp01((t - e) / 0.5);
}

function revealClip(p: number, rtl: boolean): CSSProperties {
  const rest = (1 - p) * 100;
  return { clipPath: rtl ? `inset(-25% 0 -25% ${rest}%)` : `inset(-25% ${rest}% -25% 0)` };
}

type WriteA = Extract<BoardAction, { type: "write" }>;
function WriteView({ a, ctx }: { a: WriteA; ctx: Ctx }) {
  const { t } = useSeconds();
  const dir = resolveDir(a.dir, a.text);
  const rtl = dir === "rtl";
  const p = easeInOut(progress(t, a.at, a.durationSec ?? defaultDuration(a)));
  if (t < a.at) return null;
  const px = SIZE_PX[a.size];
  const style: CSSProperties = {
    position: "absolute",
    top: `${a.y}%`,
    maxWidth: "92%",
    width: "max-content",
    opacity: eraseOpacity(a, ctx, t),
    color: inkColor(ctx.board, a.color),
    fontFamily: FONT_STACK[a.font],
    fontWeight: a.font === "hand" ? 600 : 700,
    fontSize: a.font === "hand" ? px * 1.18 : px,
    lineHeight: 1.35,
    direction: dir,
    unicodeBidi: "plaintext",
    textAlign: a.align === "center" ? "center" : "start",
  };
  if (a.align === "center") {
    style.left = `${a.x}%`;
    style.transform = "translate(-50%, -50%)";
  } else {
    const anchoredLeft = (a.align === "start") === !rtl;
    if (anchoredLeft) style.left = `${a.x}%`;
    else style.right = `${100 - a.x}%`;
    style.transform = "translateY(-50%)";
  }
  return (
    <div style={style}>
      <span style={{ display: "inline-block", ...revealClip(p, rtl) }}>{a.text}</span>
    </div>
  );
}

type DrawA = Extract<BoardAction, { type: "draw" }>;
function DrawView({ a, ctx }: { a: DrawA; ctx: Ctx }) {
  const { t } = useSeconds();
  if (t < a.at) return null;
  const p = easeInOut(progress(t, a.at, a.durationSec ?? defaultDuration(a)));
  const W = Math.max(1, (a.w / 100) * FRAME.w);
  const H = Math.max(1, (a.h / 100) * FRAME.h);
  const color = inkColor(ctx.board, a.color);
  const d = shapePath(a.shape, W, H, a.flip);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: `${a.x}%`,
        top: `${a.y}%`,
        width: `${a.w}%`,
        height: `${a.h}%`,
        overflow: "visible",
        opacity: eraseOpacity(a, ctx, t),
      }}
    >
      <path
        d={d}
        pathLength={1}
        fill={a.shape === "star" ? color : "none"}
        fillOpacity={a.shape === "star" ? p * 0.22 : 0}
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1}
        strokeDashoffset={1 - p}
        opacity={p > 0 ? 1 : 0}
      />
    </svg>
  );
}

type LetterA = Extract<BoardAction, { type: "letter" }>;
function LetterView({ a, ctx }: { a: LetterA; ctx: Ctx }) {
  const { t } = useSeconds();
  if (t < a.at) return null;
  const color = inkColor(ctx.board, a.color);
  const forms = letterForms(a.letter);
  const labels = FORM_LABELS[ctx.locale];
  const dur = a.durationSec ?? defaultDuration(a);
  const cards = a.showForms
    ? ([
        ["isolated", forms.isolated],
        ["initial", forms.initial],
        ["medial", forms.medial],
        ["final", forms.final],
      ] as const)
    : ([["isolated", forms.isolated]] as const);
  return (
    <div
      style={{
        position: "absolute",
        left: `${a.x}%`,
        top: `${a.y}%`,
        transform: "translate(-50%, -50%)",
        display: "flex",
        gap: 28,
        direction: "ltr",
        opacity: eraseOpacity(a, ctx, t),
      }}
    >
      {cards.map(([key, glyph], i) => {
        const p = easeInOut(progress(t, a.at + (i * dur) / (cards.length + 1), dur / cards.length));
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: a.showForms ? 180 : 0 }}>
            <div
              style={{
                fontFamily: FONT_STACK.naskh,
                fontWeight: 700,
                fontSize: a.showForms ? 190 : 300,
                lineHeight: 1.15,
                color,
                direction: "rtl",
                ...revealClip(p, true),
              }}
            >
              {glyph}
            </div>
            {a.showForms && (
              <div
                style={{
                  fontFamily: ctx.locale === "ar" ? FONT_STACK.naskh : FONT_STACK.hand,
                  fontSize: ctx.locale === "ar" ? 36 : 44,
                  color: inkColor(ctx.board, "ink"),
                  opacity: clamp01(p * 2) * 0.8,
                }}
              >
                {labels[key]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type AyahA = Extract<BoardAction, { type: "ayah" }>;
function AyahView({ a, ctx }: { a: AyahA; ctx: Ctx }) {
  const { t } = useSeconds();
  if (t < a.at) return null;
  const p = easeInOut(progress(t, a.at, a.durationSec ?? defaultDuration(a)));
  const px = SIZE_PX[a.size] * 1.25;
  return (
    <div
      style={{
        position: "absolute",
        left: `${a.x}%`,
        top: `${a.y}%`,
        transform: `translate(-50%, calc(-50% + ${(1 - p) * 14}px))`,
        width: "max-content",
        maxWidth: "82%",
        textAlign: "center",
        direction: "rtl",
        fontFamily: FONT_STACK.naskh,
        fontWeight: 500,
        fontSize: px,
        lineHeight: 1.9,
        color: inkColor(ctx.board, ctx.board === "chalkboard" ? "ink" : "green"),
        opacity: p * eraseOpacity(a, ctx, t),
      }}
    >
      {a.text}
    </div>
  );
}

type ImageA = Extract<BoardAction, { type: "image" }>;
function ImageView({ a, ctx }: { a: ImageA; ctx: Ctx }) {
  const { t, fps, frame } = useSeconds();
  if (t < a.at) return null;
  const s = spring({ frame: frame - Math.round(a.at * fps), fps, config: { damping: 12, stiffness: 120 } });
  return (
    <div
      style={{
        position: "absolute",
        left: `${a.x}%`,
        top: `${a.y}%`,
        width: `${a.w}%`,
        height: `${a.h}%`,
        transform: `scale(${s})`,
        opacity: eraseOpacity(a, ctx, t),
      }}
    >
      <AssetArt name={a.src} />
    </div>
  );
}

type HighlightA = Extract<BoardAction, { type: "highlight" }>;
function HighlightView({ a, ctx }: { a: HighlightA; ctx: Ctx }) {
  const { t } = useSeconds();
  if (t < a.at) return null;
  const target = ctx.all.find((x) => isDrawable(x) && x.id === a.targetId);
  const box = target ? actionBox(target) : null;
  if (!target || !box) return null;
  const gone = target && isDrawable(target) ? eraseOpacity(target, ctx, t) : 1;
  const p = easeInOut(progress(t, a.at, 0.7));
  const color = inkColor(ctx.board, a.color);
  const padX = 1.2;
  const padY = 1.6;
  const left = box.x - padX;
  const top = box.y - padY;
  const w = box.w + padX * 2;
  const h = box.h + padY * 2;
  const rtl = target.type === "write" ? resolveDir(target.dir, target.text) === "rtl" : target.type === "ayah";
  const wrap: CSSProperties = { position: "absolute", left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%`, opacity: gone };

  if (a.style === "marker") {
    return (
      <div style={wrap}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 10,
            background: color,
            opacity: ctx.board === "chalkboard" ? 0.35 : 0.3,
            transformOrigin: rtl ? "right center" : "left center",
            transform: `scaleX(${p})`,
            mixBlendMode: ctx.board === "chalkboard" ? "screen" : "multiply",
          }}
        />
      </div>
    );
  }
  const W = (w / 100) * FRAME.w;
  const H = (h / 100) * FRAME.h;
  if (a.style === "pulse") {
    const k = 1 + Math.sin((t - a.at) * 6) * 0.025;
    return (
      <div style={wrap}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 16,
            border: `6px solid ${color}`,
            boxShadow: `0 0 ${24 * p}px ${color}`,
            transform: `scale(${k})`,
            opacity: p,
          }}
        />
      </div>
    );
  }
  const d = a.style === "circle" ? shapePath("circle", W, H, false) : shapePath("underline", W, 24, false);
  return (
    <svg
      viewBox={`0 0 ${W} ${a.style === "circle" ? H : 24}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: `${left}%`,
        top: a.style === "circle" ? `${top}%` : `${top + h - 1}%`,
        width: `${w}%`,
        height: a.style === "circle" ? `${h}%` : `${(24 / FRAME.h) * 100}%`,
        overflow: "visible",
        opacity: gone,
      }}
    >
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={1}
        strokeDashoffset={1 - p}
        opacity={p > 0 ? 1 : 0}
      />
    </svg>
  );
}

export function ActionView({ action, ctx }: { action: BoardAction; ctx: Ctx }) {
  switch (action.type) {
    case "write":
      return <WriteView a={action} ctx={ctx} />;
    case "draw":
      return <DrawView a={action} ctx={ctx} />;
    case "letter":
      return <LetterView a={action} ctx={ctx} />;
    case "ayah":
      return <AyahView a={action} ctx={ctx} />;
    case "image":
      return <ImageView a={action} ctx={ctx} />;
    case "highlight":
      return <HighlightView a={action} ctx={ctx} />;
    case "erase":
      return null;
  }
}
