import React from "react";
import { Composition } from "remotion";
import { sceneDocumentSchema, VIDEO } from "../schema";
import sample from "../fixtures/sample-scene.json";
import { Whiteboard, whiteboardDurationInFrames, WHITEBOARD_ID, type WhiteboardProps } from "./Whiteboard";



const defaultProps: WhiteboardProps = {
  doc: sceneDocumentSchema.parse(sample),
  audio: {},
  assets: { mascotPoses: {} },
};

export function RemotionRoot() {
  return (
    <Composition
      id={WHITEBOARD_ID}
      component={Whiteboard}
      width={VIDEO.width}
      height={VIDEO.height}
      fps={VIDEO.fps}
      durationInFrames={whiteboardDurationInFrames(defaultProps.doc)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: whiteboardDurationInFrames(props.doc),
        fps: VIDEO.fps,
        width: VIDEO.width,
        height: VIDEO.height,
      })}
    />
  );
}
