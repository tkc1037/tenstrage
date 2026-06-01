/**
 * TaxiVideo — remotion-scenes スタイルで構築したタクシー転職Shorts動画
 * 背景: BackgroundBokeh（ボケ光源）
 * テキスト: TextKineticパターン（spring bounce per-char）
 * カラー: remotion-scenes C パレット（gold/warning）
 */

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  random,
} from 'remotion';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { C, lerp, EASE, font } from './common';

// ── Bokeh背景（remotion-scenes BackgroundBokeh ベース、ゴールド配色） ──
const TaxiBokehBg: React.FC<{ bgImageSrc?: string }> = ({ bgImageSrc }) => {
  const frame = useCurrentFrame();
  const bokehCount = 18;

  const bokehs = React.useMemo(() => {
    return Array.from({ length: bokehCount }).map((_, i) => ({
      id: `bokeh-${i}`,
      x: random(`bokeh-x-${i}`) * 100,
      y: random(`bokeh-y-${i}`) * 100,
      size: random(`bokeh-s-${i}`) * 180 + 60,
      color: [C.gold, C.warning, C.orange, C.yellow][i % 4],
      speedX: (random(`bokeh-sx-${i}`) - 0.5) * 0.2,
      speedY: (random(`bokeh-sy-${i}`) - 0.5) * 0.2,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景画像（Gemini Imagen）*/}
      {bgImageSrc && (
        <AbsoluteFill>
          <Img
            src={staticFile(bgImageSrc)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }}
          />
        </AbsoluteFill>
      )}

      {/* Bokehライト */}
      {bokehs.map((b) => {
        const x = (b.x + frame * b.speedX) % 120 - 10;
        const y = (b.y + frame * b.speedY) % 120 - 10;
        const pulse = 0.8 + Math.sin(frame * 0.04 + b.x) * 0.2;
        return (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: b.size * pulse,
              height: b.size * pulse,
              background: `radial-gradient(circle, ${b.color}50 0%, transparent 70%)`,
              borderRadius: '50%',
              filter: 'blur(40px)',
              opacity: lerp(frame, [0, 30], [0, 0.55]),
            }}
          />
        );
      })}

      {/* 下からの暗いグラデ（テキスト可読性） */}
      <AbsoluteFill style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)',
      }} />
    </AbsoluteFill>
  );
};

// ── キネティックテキスト（remotion-scenes TextKinetic ベース） ──────
const KineticText: React.FC<{
  text: string;
  startFrame: number;
  fontSize?: number;
  color?: string;
  accentColor?: string;
  showUnderline?: boolean;
}> = ({ text, startFrame, fontSize = 64, color = C.white, accentColor = C.gold, showUnderline = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = text.split('');

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {chars.map((char, i) => {
          const delay = startFrame + i * 2;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 14, stiffness: 220, mass: 0.7 },
          });
          const bounce = Math.sin((frame - delay) * 0.12) * 3 * progress;

          return (
            <span
              key={`${i}-${char}`}
              style={{
                fontFamily: font,
                fontSize,
                fontWeight: 800,
                color,
                display: 'inline-block',
                transform: `translateY(${interpolate(progress, [0, 1], [40, 0]) + bounce}px) scale(${interpolate(progress, [0, 1], [0.6, 1])})`,
                opacity: progress,
                letterSpacing: 1,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        })}
      </div>

      {showUnderline && (
        <div style={{
          width: lerp(frame, [startFrame + chars.length * 2 + 10, startFrame + chars.length * 2 + 35], [0, 240], EASE.out),
          height: 5,
          background: accentColor,
          borderRadius: 3,
          marginTop: 10,
          boxShadow: `0 0 12px ${accentColor}`,
        }} />
      )}
    </div>
  );
};

// ── シーン1: フック ─────────────────────────────────────────────────
const HookScene: React.FC<{ hook: string; accentColor: string }> = ({ hook, accentColor }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      padding: '100px 64px',
      gap: 28,
    }}>
      {/* ラベルバッジ */}
      <div style={{
        opacity: lerp(frame, [0, 18], [0, 1]),
        transform: `scale(${lerp(frame, [0, 18], [0.7, 1], EASE.out)})`,
        backgroundColor: accentColor,
        paddingInline: 22,
        paddingBlock: 9,
        borderRadius: 6,
        boxShadow: `0 0 20px ${accentColor}80`,
      }}>
        <span style={{
          fontFamily: font,
          color: C.black,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: 3,
        }}>
          知ってた？
        </span>
      </div>

      {/* メインフック — キネティックタイポ */}
      <div style={{ textAlign: 'center', maxWidth: 900 }}>
        <KineticText
          text={hook}
          startFrame={12}
          fontSize={58}
          color={C.white}
          accentColor={accentColor}
          showUnderline
        />
      </div>
    </AbsoluteFill>
  );
};

// ── シーン2: 本編ポイント ─────────────────────────────────────────
const InfoScene: React.FC<{ lines: string[]; accentColor: string }> = ({ lines, accentColor }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'flex-start',
      flexDirection: 'column',
      padding: '80px 64px',
      gap: 36,
    }}>
      {/* セクションラベル */}
      <div style={{
        opacity: lerp(frame, [0, 15], [0, 1]),
        borderLeft: `6px solid ${accentColor}`,
        paddingLeft: 18,
        boxShadow: `inset 4px 0 0 ${accentColor}`,
      }}>
        <span style={{ fontFamily: font, color: C.gray[400], fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
          POINT
        </span>
      </div>

      {/* ポイント一覧 */}
      {lines.map((line, i) => {
        const start = 18 + i * 30;
        const progress = lerp(frame, [start, start + 20], [0, 1], EASE.out);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 20,
              opacity: progress,
              transform: `translateX(${lerp(frame, [start, start + 20], [-50, 0], EASE.out)}px)`,
            }}
          >
            {/* 番号 */}
            <span style={{
              fontFamily: font,
              fontSize: 22,
              fontWeight: 900,
              color: accentColor,
              flexShrink: 0,
              lineHeight: 1.6,
              textShadow: `0 0 10px ${accentColor}`,
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            {/* テキスト */}
            <span style={{
              fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
              fontSize: 32,
              fontWeight: 700,
              color: C.white,
              lineHeight: 1.5,
            }}>
              {line}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── シーン3: CTA ────────────────────────────────────────────────
const CtaScene: React.FC<{ cta: string; title: string; accentColor: string }> = ({ cta, title, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bounce = spring({ frame, fps, config: { damping: 10, stiffness: 160 } });
  const arrowY = Math.sin((frame / fps) * Math.PI * 3) * 7;

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      padding: '80px 64px',
      gap: 32,
    }}>
      {/* 記事タイトル */}
      <div style={{
        opacity: lerp(frame, [0, 20], [0, 1]),
        textAlign: 'center',
      }}>
        <span style={{
          fontFamily: '"Noto Sans JP", sans-serif',
          fontSize: 26,
          color: C.gray[300],
          lineHeight: 1.6,
        }}>
          {title}
        </span>
      </div>

      {/* 区切り線 */}
      <div style={{
        width: lerp(frame, [12, 40], [0, 280], EASE.out),
        height: 2,
        background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`,
      }} />

      {/* CTAボタン */}
      <div style={{
        transform: `scale(${interpolate(bounce, [0, 1], [0.65, 1])})`,
        background: `linear-gradient(135deg, ${accentColor} 0%, ${C.orange} 100%)`,
        paddingInline: 44,
        paddingBlock: 22,
        borderRadius: 14,
        textAlign: 'center',
        boxShadow: `0 0 40px ${accentColor}60, 0 8px 24px rgba(0,0,0,0.4)`,
      }}>
        <span style={{
          fontFamily: font,
          color: C.black,
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: 1,
        }}>
          {cta}
        </span>
      </div>

      {/* バウンス矢印 */}
      <div style={{
        transform: `translateY(${arrowY}px)`,
        opacity: lerp(frame, [22, 38], [0, 1]),
        fontSize: 44,
      }}>
        👆
      </div>

      {/* ハッシュタグ */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        right: 44,
        fontFamily: font,
        color: C.gray[600],
        fontSize: 15,
        letterSpacing: 1,
        textAlign: 'right',
        lineHeight: 1.6,
      }}>
        #Takuzo_taxi{'\n'}#タクゾータクシー
      </div>
    </AbsoluteFill>
  );
};

// ── メインコンポジション ─────────────────────────────────────────
export interface TaxiVideoProps {
  title: string;
  hook: string;
  lines: string[];
  cta: string;
  audioSrc?: string;
  bgImageSrc?: string;
  accentColor?: string;
}

export const TaxiVideo: React.FC<TaxiVideoProps> = ({
  title,
  hook,
  lines,
  cta,
  audioSrc,
  bgImageSrc,
  accentColor = C.gold,
}) => {
  const HOOK_FRAMES = 90;
  const INFO_FRAMES = 120;
  const CTA_FRAMES = 90;
  const T = 15; // transition frames

  return (
    <AbsoluteFill style={{ backgroundColor: C.black }}>
      {/* 音声 */}
      {audioSrc && <Audio src={staticFile(audioSrc)} />}

      {/* Bokeh背景（全シーン共通） */}
      <Sequence from={0} durationInFrames={HOOK_FRAMES + INFO_FRAMES + CTA_FRAMES}>
        <TaxiBokehBg bgImageSrc={bgImageSrc} />
      </Sequence>

      {/* シーン遷移 */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK_FRAMES}>
          <HookScene hook={hook} accentColor={accentColor} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={INFO_FRAMES}>
          <InfoScene lines={lines} accentColor={accentColor} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={CTA_FRAMES}>
          <CtaScene cta={cta} title={title} accentColor={accentColor} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
