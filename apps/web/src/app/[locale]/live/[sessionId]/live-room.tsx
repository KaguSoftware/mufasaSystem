"use client";

import "@livekit/components-styles";
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Hand, LogOut, MicOff, Users, Video, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { moderateRoom } from "@/server/actions/live";
import { windowState } from "@/lib/live-window";
import { useLiveError } from "@/components/live/use-live-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Props = {
  sessionId: string;
  title: string;
  mode: "livekit" | "external_link";
  status: "scheduled" | "live" | "ended" | "cancelled";
  role: "tutor" | "student";
  startsAt: string;
  durationMin: number;
  tutorName: string;
  whenLabel: string;
  exitHref: string;
};

type JoinResponse =
  | { ok: true; kind: "livekit"; token: string; url: string }
  | { ok: true; kind: "external"; url: string }
  | { ok: false; error: { code: string; message?: string; fieldErrors?: Record<string, string[]> } };

/** Maps our design tokens onto LiveKit's CSS variables so the stock components match the app. */
const themeVars = {
  "--lk-bg": "var(--bg)",
  "--lk-bg2": "var(--surface)",
  "--lk-bg3": "var(--surface-2)",
  "--lk-fg": "var(--text)",
  "--lk-fg2": "var(--muted)",
  "--lk-border-color": "var(--border)",
  "--lk-control-bg": "var(--surface-2)",
  "--lk-control-hover-bg": "var(--surface-3)",
  "--lk-control-active-bg": "var(--surface-3)",
  "--lk-control-active-hover-bg": "var(--surface-3)",
  "--lk-accent-bg": "var(--primary)",
  "--lk-accent-fg": "var(--primary-fg)",
  "--lk-danger": "var(--danger)",
  "--lk-success-bg": "var(--success)",
  "--lk-radius": "0.75rem",
} as React.CSSProperties;

export function LiveRoom(props: Props) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const [phase, setPhase] = useState<"lobby" | "waiting" | "room" | "left">("lobby");
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  useEffect(
    () => () => {
      waitingRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    },
    [],
  );

  const win = windowState(new Date(props.startsAt), props.durationMin, new Date(now));
  const over = props.status === "ended" || props.status === "cancelled" || win === "closed";

  const request = useCallback(async (): Promise<"ok" | "wait" | "fail"> => {
    const res = await fetch("/api/live/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: props.sessionId }),
    });
    const json = (await res.json().catch(() => null)) as JoinResponse | null;
    if (!json) {
      setError(t("err.generic"));
      return "fail";
    }
    if (!json.ok) {
      if (json.error.message === "tutor_not_joined") return "wait";
      setError(errText({ code: json.error.code as never, message: json.error.message, fieldErrors: json.error.fieldErrors }));
      return "fail";
    }
    if (json.kind === "external") {
      window.open(json.url, "_blank", "noopener,noreferrer");
      return "ok";
    }
    setConn({ token: json.token, url: json.url });
    setPhase("room");
    return "ok";
  }, [props.sessionId, errText, t]);

  async function join() {
    setError(null);
    setBusy(true);
    waitingRef.current = true;
    const r = await request();
    setBusy(false);
    if (r === "wait") {
      setPhase("waiting");
      const poll = async () => {
        if (!waitingRef.current) return;
        const next = await request();
        if (!waitingRef.current) return;
        if (next === "wait") pollRef.current = setTimeout(poll, 5000);
        else if (next === "fail") setPhase("lobby");
      };
      pollRef.current = setTimeout(poll, 5000);
    }
  }

  function cancelWaiting() {
    waitingRef.current = false;
    if (pollRef.current) clearTimeout(pollRef.current);
    setPhase("lobby");
  }

  if (phase === "room" && conn) {
    return (
      <div data-lk-theme="default" style={themeVars} className="flex h-dvh flex-col bg-bg text-text">
        <LiveKitRoom
          serverUrl={conn.url}
          token={conn.token}
          connect
          audio={props.role === "tutor"}
          video={props.role === "tutor"}
          onDisconnected={() => setPhase("left")}
          onError={(e) => toast.error(e.message)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <RoomView {...props} onLeave={() => setPhase("left")} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }

  const ended = phase === "left";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10">
      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">{props.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {props.whenLabel} · {t("minutes", { n: props.durationMin })}
            {props.role === "student" ? ` · ${props.tutorName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{props.mode === "livekit" ? t("modeLivekit") : t("modeExternal")}</Badge>
          {props.status === "live" && <Badge tone="success">{t("sessionStatus.live")}</Badge>}
          {props.status === "cancelled" && <Badge tone="danger">{t("sessionStatus.cancelled")}</Badge>}
        </div>

        {ended ? (
          <p className="text-sm">{t("youLeft")}</p>
        ) : over ? (
          <p className="text-sm text-muted">{t("sessionOver")}</p>
        ) : win === "too_early" ? (
          <p className="text-sm text-muted">{t("tooEarly")}</p>
        ) : phase === "waiting" ? (
          <p className="flex items-center gap-2 text-sm">
            <span className="size-2 animate-pulse rounded-full bg-warning" />
            {t("waitingForTutor")}
          </p>
        ) : props.role === "student" && props.mode === "livekit" ? (
          <p className="text-sm text-muted">{t("studentRules")}</p>
        ) : null}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {!ended && !over && win === "open" && phase !== "waiting" && (
            <Button onClick={join} loading={busy}>
              {props.mode === "external_link" ? <ExternalLink className="size-4" /> : <Video className="size-4" />}
              {props.mode === "external_link" ? t("joinExternal") : props.role === "tutor" ? t("startClass") : t("joinClass")}
            </Button>
          )}
          {phase === "waiting" && (
            <Button variant="outline" onClick={cancelWaiting}>
              {t("cancelWaiting")}
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={props.exitHref}>{t("backToPanel")}</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}

// ───────────── in-room UI ─────────────

type HandMsg = { type: "hand"; raised: boolean } | { type: "lower"; target: string };

function RoomView({ sessionId, title, role, onLeave }: Props & { onLeave: () => void }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [showPeople, setShowPeople] = useState(false);
  const [hands, setHands] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const encoder = useRef(new TextEncoder());
  const decoder = useRef(new TextDecoder());

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const { send } = useDataChannel("hand", (msg) => {
    let data: HandMsg;
    try {
      data = JSON.parse(decoder.current.decode(msg.payload)) as HandMsg;
    } catch {
      return;
    }
    const from = msg.from?.identity;
    if (data.type === "hand" && from) {
      setHands((prev) => {
        const next = new Set(prev);
        if (data.raised) next.add(from);
        else next.delete(from);
        return next;
      });
    } else if (data.type === "lower") {
      // Only the tutor may lower someone else's hand.
      let senderRole: string | undefined;
      try {
        senderRole = (JSON.parse(msg.from?.metadata ?? "{}") as { role?: string }).role;
      } catch {
        senderRole = undefined;
      }
      if (senderRole === "tutor") {
        setHands((prev) => {
          const next = new Set(prev);
          next.delete(data.target);
          return next;
        });
      }
    }
  });

  const myId = localParticipant.identity;
  const handUp = hands.has(myId);

  async function toggleHand() {
    const raised = !handUp;
    setHands((prev) => {
      const next = new Set(prev);
      if (raised) next.add(myId);
      else next.delete(myId);
      return next;
    });
    await send(encoder.current.encode(JSON.stringify({ type: "hand", raised } satisfies HandMsg)), { reliable: true });
  }

  async function lowerHand(identity: string) {
    setHands((prev) => {
      const next = new Set(prev);
      next.delete(identity);
      return next;
    });
    await send(encoder.current.encode(JSON.stringify({ type: "lower", target: identity } satisfies HandMsg)), { reliable: true });
  }


  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          {hands.size > 0 && role === "tutor" && (
            <Badge tone="warning">
              <Hand className="size-3" />
              {hands.size}
            </Badge>
          )}
          <Badge>{t("participantsCount", { n: participants.length })}</Badge>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 p-2">
          <GridLayout tracks={tracks} style={{ height: "100%" }}>
            <ParticipantTile />
          </GridLayout>
        </div>
        {showPeople && (
          <aside className="absolute inset-y-0 end-0 z-10 flex w-72 max-w-full flex-col border-s border-border bg-surface shadow-lg sm:static sm:shadow-none">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold">{t("participants")}</span>
              <Button size="icon" variant="ghost" aria-label={t("close")} onClick={() => setShowPeople(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {participants.map((p) => {
                const raised = hands.has(p.identity);
                const isMe = p.identity === myId;
                return (
                  <li key={p.identity} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{p.name || p.identity}</span>
                      {isMe && <span className="text-xs text-muted">({t("you")})</span>}
                      {raised && (
                        <Badge tone="warning">
                          <Hand className="size-3" />
                        </Badge>
                      )}
                      {!p.isMicrophoneEnabled && <MicOff className="size-3.5 shrink-0 text-muted" />}
                    </span>
                    {role === "tutor" && !isMe && (
                      <span className="flex shrink-0 gap-1">
                        {raised && (
                          <Button size="sm" variant="outline" onClick={() => lowerHand(p.identity)}>
                            {t("lowerHand")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            const res = await moderateRoom({ sessionId, op: { type: "remove", identity: p.identity } });
                            setBusy(false);
                            if (!res.ok) return toast.error(errText(res.error));
                            toast.success(t("removedToast"));
                          }}
                        >
                          {t("removeParticipant")}
                        </Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-border bg-surface px-3 py-3">
        <TrackToggle source={Track.Source.Microphone} showIcon>
          {t("mic")}
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera} showIcon>
          {t("camera")}
        </TrackToggle>
        {role === "tutor" && (
          <TrackToggle source={Track.Source.ScreenShare} showIcon captureOptions={{ audio: true }}>
            {t("shareScreen")}
          </TrackToggle>
        )}
        {role === "student" && (
          <Button variant={handUp ? "primary" : "outline"} onClick={toggleHand} className={cn(handUp && "animate-pulse")}>
            <Hand className="size-4" />
            {handUp ? t("lowerMyHand") : t("raiseHand")}
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowPeople((v) => !v)}>
          <Users className="size-4" />
          {t("participants")}
        </Button>
        {role === "tutor" && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await moderateRoom({ sessionId, op: { type: "muteAll" } });
              setBusy(false);
              if (!res.ok) return toast.error(errText(res.error));
              toast.success(t("mutedAllToast", { n: res.data.muted ?? 0 }));
            }}
          >
            <MicOff className="size-4" />
            {t("muteAll")}
          </Button>
        )}
        <Button variant="danger" onClick={onLeave}>
          <LogOut className="size-4" />
          {t("leave")}
        </Button>
      </footer>
    </>
  );
}

