import React from "react";
import type { ReactNode } from "react";

/** Small flat SVG library for the `image` action. Keys are what Gemini may use. */
export const ASSET_KEYS = ["apple", "book", "star", "house", "cat", "sun", "moon", "mosque", "pen", "heart"] as const;
export type AssetKey = (typeof ASSET_KEYS)[number];

const S = "#374151";

const art: Record<AssetKey, ReactNode> = {
  apple: (
    <>
      <path d="M50 28 C30 14 8 30 12 58 C16 84 36 94 50 88 C64 94 84 84 88 58 C92 30 70 14 50 28Z" fill="#ef4444" stroke={S} strokeWidth="3" />
      <path d="M50 28 C50 18 54 10 60 6" fill="none" stroke="#7c4a1e" strokeWidth="5" strokeLinecap="round" />
      <path d="M56 16 C66 6 80 10 82 18 C72 24 62 22 56 16Z" fill="#22c55e" stroke={S} strokeWidth="2.5" />
      <path d="M24 46 C24 38 28 34 33 32" fill="none" stroke="#fecaca" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M10 22 L48 28 L48 88 L10 82Z" fill="#60a5fa" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      <path d="M90 22 L52 28 L52 88 L90 82Z" fill="#3b82f6" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      <path d="M18 36 L42 40 M18 48 L42 52 M18 60 L42 64" stroke="#dbeafe" strokeWidth="3" strokeLinecap="round" />
      <path d="M58 40 L82 36 M58 52 L82 48 M58 64 L82 60" stroke="#dbeafe" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  star: (
    <path
      d="M50 6 L62 36 L94 38 L69 58 L77 90 L50 72 L23 90 L31 58 L6 38 L38 36Z"
      fill="#fbbf24"
      stroke={S}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  ),
  house: (
    <>
      <path d="M12 48 L50 14 L88 48Z" fill="#ef4444" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      <rect x="20" y="48" width="60" height="42" fill="#fde68a" stroke={S} strokeWidth="3" />
      <rect x="42" y="62" width="16" height="28" rx="2" fill="#92400e" stroke={S} strokeWidth="2.5" />
      <rect x="26" y="56" width="12" height="12" fill="#bae6fd" stroke={S} strokeWidth="2.5" />
      <rect x="62" y="56" width="12" height="12" fill="#bae6fd" stroke={S} strokeWidth="2.5" />
    </>
  ),
  cat: (
    <>
      <path
        d="M18 40 L22 12 L40 28 C46 26 54 26 60 28 L78 12 L82 40 C90 54 84 78 50 82 C16 78 10 54 18 40Z"
        fill="#fb923c"
        stroke={S}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="37" cy="52" r="5" fill={S} />
      <circle cx="63" cy="52" r="5" fill={S} />
      <path d="M46 62 L54 62 L50 67Z" fill="#f472b6" />
      <path d="M50 67 C47 72 42 72 40 69 M50 67 C53 72 58 72 60 69" fill="none" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 62 L38 64 M22 70 L38 68 M78 62 L62 64 M78 70 L62 68" stroke={S} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  sun: (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI * 2) / 12;
        return (
          <line
            key={i}
            x1={50 + Math.cos(a) * 34}
            y1={50 + Math.sin(a) * 34}
            x2={50 + Math.cos(a) * 46}
            y2={50 + Math.sin(a) * 46}
            stroke="#f59e0b"
            strokeWidth="5"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="50" cy="50" r="26" fill="#fbbf24" stroke={S} strokeWidth="3" />
      <circle cx="42" cy="46" r="3" fill={S} />
      <circle cx="58" cy="46" r="3" fill={S} />
      <path d="M42 58 C47 64 53 64 58 58" fill="none" stroke={S} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  moon: (
    <>
      <path
        d="M62 8 C36 12 20 34 24 58 C28 82 52 94 76 88 C52 84 40 62 46 40 C50 26 56 16 62 8Z"
        fill="#fde68a"
        stroke={S}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M80 20 L83 28 L91 29 L85 34 L87 42 L80 38 L73 42 L75 34 L69 29 L77 28Z" fill="#fbbf24" stroke={S} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  mosque: (
    <>
      <rect x="8" y="30" width="10" height="60" fill="#e5e7eb" stroke={S} strokeWidth="3" />
      <path d="M8 30 L13 14 L18 30Z" fill="#14b8a6" stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="82" y="30" width="10" height="60" fill="#e5e7eb" stroke={S} strokeWidth="3" />
      <path d="M82 30 L87 14 L92 30Z" fill="#14b8a6" stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="24" y="52" width="52" height="38" fill="#fef3c7" stroke={S} strokeWidth="3" />
      <path d="M26 52 C26 22 74 22 74 52Z" fill="#14b8a6" stroke={S} strokeWidth="3" />
      <path d="M50 24 L50 14 M46 18 L54 18" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      <path d="M42 90 L42 72 C42 62 58 62 58 72 L58 90Z" fill="#92400e" stroke={S} strokeWidth="2.5" />
    </>
  ),
  pen: (
    <>
      <path d="M14 86 L22 62 L72 12 L88 28 L38 78Z" fill="#fbbf24" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      <path d="M72 12 L88 28 L94 22 C96 16 84 6 78 6Z" fill="#f87171" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 86 L22 62 L38 78Z" fill="#fde68a" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 86 L17 77 L23 83Z" fill={S} />
    </>
  ),
  heart: (
    <path
      d="M50 88 C20 66 8 48 12 32 C16 16 38 12 50 30 C62 12 84 16 88 32 C92 48 80 66 50 88Z"
      fill="#f43f5e"
      stroke={S}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  ),
};

export function isAssetKey(k: string): k is AssetKey {
  return (ASSET_KEYS as readonly string[]).includes(k);
}

export function AssetArt({ name }: { name: string }) {
  const key = name.toLowerCase().trim();
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label={name}>
      {isAssetKey(key) ? (
        art[key]
      ) : (
        <>
          <rect x="12" y="12" width="76" height="76" rx="12" fill="#f3f4f6" stroke={S} strokeWidth="3" strokeDasharray="6 5" />
          <text x="50" y="62" textAnchor="middle" fontSize="40" fill={S}>
            ?
          </text>
        </>
      )}
    </svg>
  );
}
