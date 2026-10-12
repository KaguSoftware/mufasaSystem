# AI Studio and the whiteboard video pipeline

## Why not a video model

Video models (Veo etc.) cannot keep a mascot consistent across clips and garble Arabic text. So Gemini writes **structured scenes** and we **render** them ourselves with Remotion: same mascot every time, correct Arabic shaping, verbatim Quran text, editable and re-renderable.

## Flow

1. **Chat** (`/tutor/studio/<conversationId>`): tutor picks a lesson (its `context`: objectives, approach, vocabulary, ayah references, notes) and pastes any extra material. She chats with Gemini (streaming, `POST /api/studio/chat`) to shape the script. System prompt: `buildSystemPrompt` in `apps/web/src/lib/ai-studio.ts` (pedagogy, pacing, mascot, scene vocabulary, house style, no em dashes).
2. **Save + approve a script** version (any model message or edited text).
3. **Generate scenes**: Gemini structured output (`responseJsonSchema` = `sceneDocumentJsonSchema()` from `packages/video/src/schema.ts`, simplified by `toGeminiSchema`), validated with zod (one retry with errors fed back). Every `ayah` action's text is **replaced with `quran_ayahs.text_uthmani`**; unknown ayat are dropped with a warning. Saved to `video_projects.scene_json`.
4. **Edit** scenes in the project editor (narration, mascot pose/position, actions JSON with live validation) with a live `@remotion/player` preview.
5. **Voice**: job `tts_project`: Gemini TTS per scene (prebuilt voice, defaults ar=Kore, en=Leda, tr=Aoede; verify the voice list in `src/lib/studio-voices.ts` against Google's docs), PCM wrapped to WAV, uploaded to `tts-audio`, durations written back into the scenes.
6. **Render**: job `render_video`: Remotion bundles `packages/video/src/remotion/index.ts`, renders H.264 MP4, uploads to `lesson-videos`.
7. **Publish**: sets the lesson's `video_path` / `video_duration_sec`.

Limits: `ai.chat`, `ai.scenes`, `ai.tts` rate limits; flag `ai_studio`.

## Scene document (the contract)

`packages/video/src/schema.ts`. Coordinates are percentages of the board. Per scene: `narration`, `mascot { pose, position }`, `clearBoardBefore`, `actions[]` with `at` (seconds into the scene):

| Action | Purpose |
| --- | --- |
| `write` | Text (Arabic via Naskh, Latin via a hand font), stroke-reveal animation |
| `draw` | arrow, line, circle, rect, underline, check, cross, star, bracket |
| `letter` | An Arabic letter with its isolated/initial/medial/final forms |
| `ayah` | Verbatim Quran text (filled from the DB) |
| `image` | Built-in SVG asset by key (apple, book, star, house, cat, sun, moon, mosque, pen, heart) |
| `highlight` | marker / circle / underline / pulse on an element by id |
| `erase` | one element or the whole board |

## The mascot

A placeholder owl (`packages/video/src/remotion/Mascot.tsx`) with poses idle, talk, point, think, celebrate, wave, write. When the brand mascot exists, upload one image per pose and register them in the `mascots` table (`poses` JSON: pose to asset path). The renderer uses those instead of the built-in owl.

## Running the worker

```bash
pnpm worker                                   # long-running, needs DATABASE_URL (+ Supabase, Gemini for real jobs)
pnpm --filter render-worker render:sample     # offline test: renders the fixture to apps/render-worker/render-output/sample.mp4
```

The offline sample was rendered successfully during development (34 s, 1080p, Arabic shaping verified on stills). First run downloads a headless Chrome (about 120 MB).

Hosting: needs Chrome + ffmpeg, so not Vercel functions. A container on Railway/Fly/VPS with 2+ vCPU and 4 GB RAM is comfortable. Scale by running more worker processes; job claiming is concurrency-safe.

## Licensing note

Remotion is free for individuals and companies with up to 3 employees; larger companies need a Remotion company license. The `@remotion/player` usage sets `acknowledgeRemotionLicense`. Confirm which applies to the client.

## Unverified until keys exist

- Gemini's acceptance of the simplified JSON schema and of `audio/webm` recitation uploads (a transcode step may be needed).
- TTS output format (handled generically from the returned mime type).
