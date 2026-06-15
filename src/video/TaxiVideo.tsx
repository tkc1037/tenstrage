/**
 * TaxiVideo — Tenstrage縦型動画テンプレート
 *
 * bgStyle で背景を動的切り替え:
 *   'bokeh'     (default) BackgroundBokeh  — ボケ光源
 *   'aurora'              BackgroundAurora — オーロラ
 *   'waves'               BackgroundWaves  — 波
 *   'grid'                BackgroundGrid   — グリッド
 *   'geometric'           BackgroundGeometric — 幾何学
 *   'gradient'            BackgroundFlowingGradient — グラデーション
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
} from 'remotion';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { C, lerp, EASE, font } from './common';

// remotion-scenes (MIT) を元に、使用する背景だけをプロジェクト内で管理
import { BackgroundBokeh }           from './backgrounds/BackgroundBokeh';
import { BackgroundAurora }          from './backgrounds/BackgroundAurora';
import { BackgroundWaves }           from './backgrounds/BackgroundWaves';
import { BackgroundGrid }            from './backgrounds/BackgroundGrid';
import { BackgroundGeometric }       from './backgrounds/BackgroundGeometric';
import { BackgroundFlowingGradient } from './backgrounds/BackgroundFlowingGradient';

export type BgStyle = 'bokeh' | 'aurora' | 'waves' | 'grid' | 'geometric' | 'gradient';

// ── 背景セレクタ ─────────────────────────────────────────────────
const BgLayer: React.FC<{
  bgStyle: BgStyle;
  bgImageSrc?: string;
  imageOpacity: number;
  gradientOpacity: number;
}> = ({ bgStyle, bgImageSrc, imageOpacity, gradientOpacity }) => {
  const BgMap: Record<BgStyle, React.FC<{ startDelay?: number }>> = {
    bokeh:     BackgroundBokeh,
    aurora:    BackgroundAurora,
    waves:     BackgroundWaves,
    grid:      BackgroundGrid,
    geometric: BackgroundGeometric,
    gradient:  BackgroundFlowingGradient,
  };
  const BgComponent = BgMap[bgStyle] ?? BackgroundBokeh;

  return (
    <AbsoluteFill>
      {/* ライブラリ背景 */}
      <BgComponent startDelay={0} />

      {/* Gemini Imagen 生成背景画像（オーバーレイ） */}
      {bgImageSrc && (
        <AbsoluteFill>
          <Img
            src={staticFile(bgImageSrc)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imageOpacity }}
          />
        </AbsoluteFill>
      )}

      {/* 下部グラデ（テキスト可読性確保） */}
      <AbsoluteFill style={{
        background: `linear-gradient(to top, rgba(0,0,0,${gradientOpacity}) 0%, transparent 55%)`,
      }} />
    </AbsoluteFill>
  );
};

// ── キネティックテキスト ─────────────────────────────────────────
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

// ── シーン1: フック ──────────────────────────────────────────────
const HookScene: React.FC<{
  hook: string;
  accentColor: string;
  label?: string;
  settings: TaxiVideoSettings;
}> = ({
  hook, accentColor, settings, label = '知ってた？',
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      padding: `100px ${settings.horizontalPadding}px`,
      gap: 28,
    }}>
      <div style={{
        opacity: lerp(frame, [0, 18], [0, 1]),
        transform: `scale(${lerp(frame, [0, 18], [0.7, 1], EASE.out)})`,
        backgroundColor: accentColor,
        paddingInline: 22,
        paddingBlock: 9,
        borderRadius: 6,
        boxShadow: `0 0 20px ${accentColor}80`,
      }}>
        <span style={{ fontFamily: font, color: C.black, fontSize: settings.hookLabelFontSize, fontWeight: 800, letterSpacing: 3 }}>
          {label}
        </span>
      </div>

      <div style={{ textAlign: 'center', maxWidth: 900 }}>
        <KineticText
          text={hook}
          startFrame={12}
          fontSize={settings.hookFontSize}
          color={C.white}
          accentColor={accentColor}
          showUnderline
        />
      </div>
    </AbsoluteFill>
  );
};

// ── シーン2: 本編ポイント ──────────────────────────────────────
const InfoScene: React.FC<{
  lines: string[];
  accentColor: string;
  lineDelays?: number[];
  settings: TaxiVideoSettings;
}> = ({ lines, accentColor, lineDelays, settings }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'flex-start',
      flexDirection: 'column',
      padding: `80px ${settings.horizontalPadding}px`,
      gap: 36,
    }}>
      <div style={{
        opacity: lerp(frame, [0, 15], [0, 1]),
        borderLeft: `6px solid ${accentColor}`,
        paddingLeft: 18,
      }}>
        <span style={{ fontFamily: font, color: C.gray[400], fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
          POINT
        </span>
      </div>

      {lines.map((line, i) => {
        const start = lineDelays ? (lineDelays[i] ?? (18 + i * 30)) : 18 + i * 30;
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
            <span style={{
              fontFamily: font,
              fontSize: settings.infoNumberFontSize,
              fontWeight: 900,
              color: accentColor,
              flexShrink: 0,
              lineHeight: 1.6,
              textShadow: `0 0 10px ${accentColor}`,
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{
              fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
              fontSize: settings.infoFontSize,
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

// ── シーン3: CTA ─────────────────────────────────────────────
const CtaScene: React.FC<{
  cta: string;
  title: string;
  accentColor: string;
  settings: TaxiVideoSettings;
}> = ({ cta, title, accentColor, settings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bounce = spring({ frame, fps, config: { damping: 10, stiffness: 160 } });
  const arrowY = Math.sin((frame / fps) * Math.PI * 3) * 7;

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      padding: `80px ${settings.horizontalPadding}px`,
      gap: 32,
    }}>
      <div style={{ opacity: lerp(frame, [0, 20], [0, 1]), textAlign: 'center' }}>
        <span style={{
          fontFamily: '"Noto Sans JP", sans-serif',
          fontSize: settings.ctaTitleFontSize,
          color: C.gray[300],
          lineHeight: 1.6,
        }}>
          {title}
        </span>
      </div>

      <div style={{
        width: lerp(frame, [12, 40], [0, 280], EASE.out),
        height: 2,
        background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`,
      }} />

      <div style={{
        transform: `scale(${interpolate(bounce, [0, 1], [0.65, 1])})`,
        background: `linear-gradient(135deg, ${accentColor} 0%, ${C.orange} 100%)`,
        paddingInline: 44,
        paddingBlock: 22,
        borderRadius: 14,
        textAlign: 'center',
        boxShadow: `0 0 40px ${accentColor}60, 0 8px 24px rgba(0,0,0,0.4)`,
      }}>
        <span style={{ fontFamily: font, color: C.black, fontSize: settings.ctaFontSize, fontWeight: 900, letterSpacing: 1 }}>
          {cta}
        </span>
      </div>

      <div style={{ transform: `translateY(${arrowY}px)`, opacity: lerp(frame, [22, 38], [0, 1]), fontSize: 44 }}>
        👆
      </div>

      <div style={{
        position: 'absolute',
        bottom: 40,
        right: 44,
        fontFamily: font,
        color: C.gray[600],
        fontSize: settings.watermarkFontSize,
        letterSpacing: 1,
        textAlign: 'right',
        lineHeight: 1.6,
      }}>
        takuzo-taxi.com{'\n'}#タクシー転職
      </div>
    </AbsoluteFill>
  );
};

// ── 型定義 ───────────────────────────────────────────────────
export interface TaxiVideoTiming {
  hookFrames: number;
  infoFrames: number;
  ctaFrames: number;
  lineDelays: number[];
  totalFrames: number;
}

export interface TaxiVideoSettings {
  width: number;
  height: number;
  fps: number;
  codec: 'h264';
  transitionFrames: number;
  audioVolume: number;
  backgroundImageOpacity: number;
  bottomGradientOpacity: number;
  horizontalPadding: number;
  hookFontSize: number;
  hookLabelFontSize: number;
  infoFontSize: number;
  infoNumberFontSize: number;
  ctaTitleFontSize: number;
  ctaFontSize: number;
  watermarkFontSize: number;
}

export interface TaxiVideoProps {
  title: string;
  hook: string;
  lines: string[];
  cta: string;
  audioSrc?: string;
  bgImageSrc?: string;
  bgStyle?: BgStyle;
  accentColor?: string;
  hookLabel?: string;
  timing?: TaxiVideoTiming;
  settings?: TaxiVideoSettings;
}

// ── メインコンポジション ─────────────────────────────────────
export const TaxiVideo: React.FC<TaxiVideoProps> = ({
  title,
  hook,
  lines,
  cta,
  audioSrc,
  bgImageSrc,
  bgStyle = 'bokeh',
  accentColor = C.gold,
  hookLabel,
  timing,
  settings: inputSettings,
}) => {
  const settings: TaxiVideoSettings = {
    width: 1080,
    height: 1920,
    fps: 30,
    codec: 'h264',
    transitionFrames: 15,
    audioVolume: 1,
    backgroundImageOpacity: 0.2,
    bottomGradientOpacity: 0.88,
    horizontalPadding: 64,
    hookFontSize: 56,
    hookLabelFontSize: 20,
    infoFontSize: 32,
    infoNumberFontSize: 22,
    ctaTitleFontSize: 26,
    ctaFontSize: 26,
    watermarkFontSize: 15,
    ...inputSettings,
  };
  const HOOK_FRAMES = timing?.hookFrames ?? 90;
  const INFO_FRAMES = timing?.infoFrames ?? 120;
  const CTA_FRAMES  = timing?.ctaFrames  ?? 90;
  const T = settings.transitionFrames;
  const total = HOOK_FRAMES + INFO_FRAMES + CTA_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: C.black }}>
      {audioSrc && <Audio src={staticFile(audioSrc)} volume={settings.audioVolume} />}

      {/* 背景（ライブラリ + 画像オーバーレイ） */}
      <Sequence from={0} durationInFrames={total}>
        <BgLayer
          bgStyle={bgStyle}
          bgImageSrc={bgImageSrc}
          imageOpacity={settings.backgroundImageOpacity}
          gradientOpacity={settings.bottomGradientOpacity}
        />
      </Sequence>

      {/* シーン遷移 */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK_FRAMES}>
          <HookScene hook={hook} accentColor={accentColor} label={hookLabel} settings={settings} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={INFO_FRAMES}>
          <InfoScene lines={lines} accentColor={accentColor} lineDelays={timing?.lineDelays} settings={settings} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={CTA_FRAMES}>
          <CtaScene cta={cta} title={title} accentColor={accentColor} settings={settings} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
