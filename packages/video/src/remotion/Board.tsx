import React from "react";
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { BOARD_BG, type BoardKind } from "./theme";

export function Board({ kind, children }: { kind: BoardKind; children: ReactNode }) {
  const chalk = kind === "chalkboard";
  return (
    <AbsoluteFill style={{ background: chalk ? "#8b5e34" : "#d9dde1" }}>
      <AbsoluteFill
        style={{
          inset: 22,
          width: "auto",
          height: "auto",
          borderRadius: 18,
          overflow: "hidden",
          background: BOARD_BG[kind],
          boxShadow: chalk ? "inset 0 0 120px rgba(0,0,0,0.35)" : "inset 0 0 0 3px rgba(0,0,0,0.06)",
          backgroundImage:
            kind === "grid"
              ? "linear-gradient(rgba(15,118,110,0.14) 2px, transparent 2px), linear-gradient(90deg, rgba(15,118,110,0.14) 2px, transparent 2px)"
              : kind === "chalkboard"
                ? "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.07), transparent 60%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.7), rgba(0,0,0,0.02))",
          backgroundSize: kind === "grid" ? "60px 60px" : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
