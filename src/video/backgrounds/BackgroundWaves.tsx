/**
 * BackgroundWaves - 波形背景
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../common";

export const BackgroundWaves = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const generateWavePath = (offset: number, amplitude: number, frequency: number) => {
    let path = "M 0 360";
    for (let x = 0; x <= width; x += 10) {
      const y = 360 + Math.sin((x * frequency + (frame - startDelay) * 2 + offset) * 0.01) * amplitude;
      path += ` L ${x} ${y}`;
    }
    path += ` L ${width} 720 L 0 720 Z`;
    return path;
  };

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        {/* 波1（背面） */}
        <path
          d={generateWavePath(0, 40, 1)}
          fill={C.accent}
          opacity={0.3}
        />
        {/* 波2（中間） */}
        <path
          d={generateWavePath(100, 50, 1.5)}
          fill={C.secondary}
          opacity={0.4}
        />
        {/* 波3（前面） */}
        <path
          d={generateWavePath(200, 60, 2)}
          fill={C.tertiary}
          opacity={0.5}
        />
      </svg>
    </AbsoluteFill>
  );
};
