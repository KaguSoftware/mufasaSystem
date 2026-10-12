import React from "react";
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { totalDurationInFrames, VIDEO, type BoardAction, type Scene, type SceneDocument } from "../schema";
import { ActionView } from "./actions";
import { Board } from "./Board";
import { ensureFonts } from "./fonts";
import { Mascot, type MascotPose } from "./Mascot";
import { carryOver, sceneLayout } from "./timeline";

export const WHITEBOARD_ID = "Whiteboard";

export type WhiteboardProps = {
  doc: SceneDocument;
  /** sceneId -> narration clip (signed or public URL) and its length. Missing = silent scene. */
  audio: Record<string, { src: string; durationSec: number }>;
  assets: { mascotPoses: Partial<Record<MascotPose, string>> };
};

/** Delay before narration starts inside a scene, so board and voice do not collide on the cut. */
const AUDIO_DELAY_FRAMES = Math.round(0.15 * VIDEO.fps);

function SceneView({
  doc,
  scene,
  index,
  frames,
  audio,
  assets,
}: {
  doc: SceneDocument;
  scene: Scene;
  index: number;
  frames: number;
  audio?: { src: string; durationSec: number };
  assets: WhiteboardProps["assets"];
}) {
  const { fps } = useVideoConfig();
  void fps;
  const carried = scene.clearBoardBefore ? [] : carryOver(doc, index);
  const all: BoardAction[] = [...carried, ...scene.actions];
  const ctx = { board: doc.board, locale: doc.locale, all } as const;
  return (
    <AbsoluteFill>
      <Board kind={doc.board}>
        {all.map((action, i) => (
          <ActionView key={`${action.type}-${i}`} action={action} ctx={ctx} />
        ))}
      </Board>
      <Mascot pose={scene.mascot.pose} position={scene.mascot.position} poses={assets.mascotPoses} sceneFrames={frames} />
      {audio && (
        <Sequence from={AUDIO_DELAY_FRAMES} layout="none">
          <Audio src={audio.src} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

export function Whiteboard({ doc, audio, assets }: WhiteboardProps) {
  ensureFonts();
  const layout = sceneLayout(doc);
  return (
    <AbsoluteFill style={{ background: "#d9dde1" }}>
      {doc.scenes.map((scene, i) => (
        <Sequence key={scene.id} from={layout[i]!.from} durationInFrames={layout[i]!.frames} name={scene.id}>
          <SceneView
            doc={doc}
            scene={scene}
            index={i}
            frames={layout[i]!.frames}
            audio={audio?.[scene.id]}
            assets={assets ?? { mascotPoses: {} }}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export function whiteboardDurationInFrames(doc: SceneDocument): number {
  return Math.max(1, totalDurationInFrames(doc));
}
