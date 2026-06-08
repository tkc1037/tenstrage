/**
 * BackgroundFlowingGradient - 流れるグラデーション
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../common";

export const BackgroundFlowingGradient = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const hue1 = ((frame - startDelay) * 0.5) % 360;
  const hue2 = (hue1 + 60) % 360;
  const hue3 = (hue1 + 120) % 360;

  const angle = (frame - startDelay) * 0.5;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(
          ${angle}deg,
          hsl(${hue1}, 70%, 50%),
          hsl(${hue2}, 70%, 40%),
          hsl(${hue3}, 70%, 50%)
        )`,
      }}
    />
  );
};
