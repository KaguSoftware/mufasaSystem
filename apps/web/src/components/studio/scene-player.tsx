"use client";

import { Player } from "@remotion/player";
import { useMemo } from "react";
import { VIDEO, Whiteboard, whiteboardDurationInFrames, type SceneDocument, type WhiteboardProps } from "@mufasa/video";

/** Live preview of the scene JSON with the same composition the worker renders. Client only. */
export function ScenePlayer({
  doc,
  audio,
}: {
  doc: SceneDocument;
  audio: WhiteboardProps["audio"];
}) {
  const inputProps = useMemo<WhiteboardProps>(() => ({ doc, audio, assets: { mascotPoses: {} } }), [doc, audio]);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
      <Player
        component={Whiteboard}
        inputProps={inputProps}
        durationInFrames={whiteboardDurationInFrames(doc)}
        fps={VIDEO.fps}
        compositionWidth={VIDEO.width}
        compositionHeight={VIDEO.height}
        controls
        clickToPlay
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
