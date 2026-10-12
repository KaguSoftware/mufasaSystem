"use client";

import { Mic, RotateCcw, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { formatDuration, MAX_RECITATION_BYTES, MAX_RECITATION_SECONDS, pickRecorderMime, extensionForMime } from "@/lib/recitation-upload";

const subscribeNever = () => () => undefined;
const canRecord = () => typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export type RecordedAudio = { file: File; durationSec: number | null };

/**
 * Audio recorder: MediaRecorder (webm/opus, mp4 fallback for Safari), level meter,
 * timer with a 10 minute cap, playback before submit, and a file upload fallback.
 */
export function Recorder({ onChange, disabled }: { onChange: (audio: RecordedAudio | null) => void; disabled?: boolean }) {
  const t = useTranslations("recitation");
  const [phase, setPhase] = useState<"idle" | "recording" | "ready">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = useSyncExternalStore(subscribeNever, canRecord, () => true);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const startedAt = useRef(0);

  const cleanupMedia = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    timer.current = null;
    raf.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanupMedia();
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    };
  }, [cleanupMedia]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  function setAudio(file: File | null, durationSec: number | null) {
    setUrl(file ? URL.createObjectURL(file) : null);
    setPhase(file ? "ready" : "idle");
    onChange(file ? { file, durationSec } : null);
  }

  async function start() {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const seconds = Math.round((Date.now() - startedAt.current) / 1000);
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        cleanupMedia();
        const ext = extensionForMime(type) ?? "webm";
        setAudio(new File([blob], `recitation.${ext}`, { type: type.split(";")[0] }), Math.min(seconds, MAX_RECITATION_SECONDS));
      };

      // level meter
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtx.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(media).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3));
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      }

      startedAt.current = Date.now();
      setElapsed(0);
      rec.start(1000);
      setPhase("recording");
      timer.current = setInterval(() => {
        const s = (Date.now() - startedAt.current) / 1000;
        setElapsed(s);
        if (s >= MAX_RECITATION_SECONDS && rec.state !== "inactive") rec.stop();
      }, 250);
    } catch {
      cleanupMedia();
      setError(t("micDenied"));
    }
  }

  function stop() {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  function discard() {
    setElapsed(0);
    setAudio(null, null);
  }

  return (
    <div className="flex flex-col gap-4">
      {phase !== "ready" && supported && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-2 p-5">
          <div className="text-3xl font-semibold tabular-nums" aria-live="off">
            {formatDuration(elapsed)}
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          {phase === "idle" ? (
            <Button type="button" onClick={start} disabled={disabled}>
              <Mic className="size-4" />
              {t("startRecording")}
            </Button>
          ) : (
            <Button type="button" variant="danger" onClick={stop}>
              <Square className="size-4" />
              {t("stopRecording")}
            </Button>
          )}
          <p className="text-xs text-muted">{t("maxLength", { minutes: MAX_RECITATION_SECONDS / 60 })}</p>
        </div>
      )}
      {!supported && phase !== "ready" && <p className="text-sm text-muted">{t("recordingUnsupported")}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {phase === "ready" && url && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">{t("listenBeforeSubmit")}</p>
          <audio controls src={url} className="w-full" preload="metadata" />
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={discard} disabled={disabled}>
            <RotateCcw className="size-4" />
            {t("recordAgain")}
          </Button>
        </div>
      )}

      {phase === "idle" && (
        <FileDropzone
          accept="audio/*"
          maxSizeMb={MAX_RECITATION_BYTES / 1024 / 1024}
          value={null}
          onChange={(f) => f && setAudio(f, null)}
          label={t("uploadFile")}
          hint={t("uploadHint")}
          disabled={disabled}
        />
      )}
    </div>
  );
}
