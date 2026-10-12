import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "../schema";
import { BRAND } from "./theme";
import { clamp01 } from "./timeline";

export type MascotPose = Scene["mascot"]["pose"];
export type MascotPosition = Scene["mascot"]["position"];

const WING = "M0,0 C-34,8 -46,72 -12,104 C8,76 22,34 0,0Z";

function wingAngles(pose: MascotPose, t: number): { left: number; right: number } {
  const wob = Math.sin(t * 2.2);
  switch (pose) {
    case "idle":
      return { left: 8 + wob * 2, right: -8 - wob * 2 };
    case "talk":
      return { left: 10 + Math.sin(t * 5) * 6, right: -10 - Math.sin(t * 4.2 + 1) * 10 };
    case "point":
      return { left: 8, right: -78 + Math.sin(t * 3) * 3 };
    case "think":
      return { left: 8, right: -150 + Math.sin(t * 2) * 3 };
    case "celebrate":
      return { left: 150 + Math.sin(t * 9) * 12, right: -150 - Math.sin(t * 9) * 12 };
    case "wave":
      return { left: 8, right: -135 + Math.sin(t * 9) * 22 };
    case "write":
      return { left: 8, right: -62 + Math.sin(t * 7) * 5 };
  }
}

/** Built-in placeholder owl. Replaced by brand art through the `mascotPoses` prop. */
function OwlSvg({ pose, frame, fps }: { pose: MascotPose; frame: number; fps: number }) {
  const t = frame / fps;
  const bob = Math.sin(t * 2.4) * 5;
  const blinkPhase = frame % 130;
  const blink = blinkPhase < 5 ? Math.abs(blinkPhase - 2.5) / 2.5 : 1;
  const talking = pose === "talk" || pose === "point" || pose === "write";
  const mouth = talking ? (Math.sin(t * 13) * 0.5 + 0.5) * 11 : pose === "celebrate" ? 9 : 0;
  const look = pose === "think" ? { x: -5, y: -6 } : pose === "point" ? { x: 6, y: 0 } : { x: 0, y: 0 };
  const w = wingAngles(pose, t);

  return (
    <svg viewBox="0 0 300 360" width="100%" height="100%" style={{ overflow: "visible" }}>
      <g transform={`translate(0 ${bob})`}>
        {/* feet */}
        <path d="M100,330 q-18,18 -2,24 q14,-4 18,-14z M200,330 q18,18 2,24 q-14,-4 -18,-14z" fill={BRAND.amber} stroke="#b45309" strokeWidth="3" />
        {/* wings behind the body edge */}
        <g transform={`translate(66 200) rotate(${w.left}) scale(-1 1)`}>
          <path d={WING} fill={BRAND.tealDark} stroke="#0b3f3b" strokeWidth="3" />
        </g>
        <g transform={`translate(234 200) rotate(${w.right})`}>
          <path d={WING} fill={BRAND.tealDark} stroke="#0b3f3b" strokeWidth="3" />
        </g>
        {/* body */}
        <ellipse cx="150" cy="215" rx="98" ry="118" fill={BRAND.teal} stroke="#0b3f3b" strokeWidth="4" />
        <path d="M70,120 L58,64 L112,98Z M230,120 L242,64 L188,98Z" fill={BRAND.teal} stroke="#0b3f3b" strokeWidth="4" strokeLinejoin="round" />
        <ellipse cx="150" cy="245" rx="64" ry="78" fill={BRAND.amberLight} />
        <path d="M118,215 q10,8 20,0 M150,215 q10,8 20,0 M134,245 q10,8 20,0 M118,275 q10,8 20,0 M150,275 q10,8 20,0" fill="none" stroke="#e8c97a" strokeWidth="4" strokeLinecap="round" />
        {/* eyes */}
        {[112, 188].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy="142" rx="34" ry={34 * blink} fill="#fff" stroke="#0b3f3b" strokeWidth="3" />
            <circle cx={cx + look.x} cy={142 + look.y} r={14 * Math.max(0.3, blink)} fill="#1f2937" />
            <circle cx={cx + look.x + 4} cy={142 + look.y - 5} r={4} fill="#fff" />
          </g>
        ))}
        {/* beak */}
        <path d="M136,166 L164,166 L150,186Z" fill={BRAND.amber} stroke="#b45309" strokeWidth="3" strokeLinejoin="round" />
        {mouth > 0.5 && <path d={`M138,${184} Q150,${184 + mouth} 162,${184}Z`} fill="#7c2d12" />}
        {/* props */}
        {pose === "write" && (
          <g transform={`translate(${268 + Math.sin(t * 7) * 3} 118) rotate(35)`}>
            <rect x="-5" y="-8" width="10" height="64" rx="3" fill="#fbbf24" stroke="#92400e" strokeWidth="3" />
            <path d="M-5,56 L5,56 L0,70Z" fill="#1f2937" />
          </g>
        )}
        {pose === "think" && (
          <g fill="#fff" stroke="#9ca3af" strokeWidth="3">
            <circle cx="236" cy="30" r="7" />
            <circle cx="256" cy="6" r="11" />
            <ellipse cx="288" cy="-30" rx="26" ry="20" />
            <text x="288" y="-22" textAnchor="middle" fontSize="26" fontWeight="700" fill={BRAND.teal} stroke="none">
              ?
            </text>
          </g>
        )}
        {pose === "celebrate" &&
          [0, 1, 2, 3, 4, 5].map((i) => {
            const phase = ((frame + i * 9) % 40) / 40;
            const x = 30 + i * 48;
            return (
              <path
                key={i}
                d="M0,-10 L3,-3 L11,-3 L5,2 L7,10 L0,5 L-7,10 L-5,2 L-11,-3 L-3,-3Z"
                transform={`translate(${x} ${40 - phase * 40}) scale(${0.8 + (i % 3) * 0.3})`}
                fill={i % 2 ? BRAND.amber : "#f87171"}
                opacity={1 - phase}
              />
            );
          })}
      </g>
    </svg>
  );
}

export function Mascot({
  pose,
  position,
  poses,
  sceneFrames,
}: {
  pose: MascotPose;
  position: MascotPosition;
  /** Optional brand art per pose (URL). Falls back to the built-in owl. */
  poses?: Partial<Record<MascotPose, string>>;
  sceneFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (position === "hidden") return null;

  const enter = clamp01(frame / 12);
  const slide = interpolate(enter, [0, 1], [60, 0]);
  const dir = position === "left" ? 1 : -1;
  const custom = poses?.[pose];
  const size = 380;
  void sceneFrames;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        [position === "left" ? "left" : "right"]: 36,
        width: size,
        height: size * 1.2,
        opacity: enter,
        transform: `translateX(${-dir * slide}px) scaleX(${position === "right" ? -1 : 1})`,
        pointerEvents: "none",
      }}
    >
      {custom ? (
        <Img src={custom} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <OwlSvg pose={pose} frame={frame} fps={fps} />
      )}
    </div>
  );
}
