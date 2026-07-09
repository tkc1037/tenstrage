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
  kenBurns?: boolean;
}> = ({ bgStyle, bgImageSrc, imageOpacity, gradientOpacity, kenBurns = false }) => {
  const frame = useCurrentFrame();
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

      {/* 生成背景画像（オーバーレイ） */}
      {bgImageSrc && (
        <AbsoluteFill>
          <Img
            src={staticFile(bgImageSrc)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: imageOpacity,
              transform: kenBurns ? `scale(${lerp(frame, [0, 240], [1.02, 1.1])})` : undefined,
            }}
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

const BgmTrack: React.FC<{
  src: string;
  volume: number;
  totalFrames: number;
  fadeFrames: number;
}> = ({ src, volume, totalFrames, fadeFrames }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, fadeFrames], [0, volume], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [Math.max(0, totalFrames - fadeFrames), totalFrames], [volume, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <Audio src={staticFile(src)} volume={Math.min(fadeIn, fadeOut)} />;
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
  label?: string;
  settings: TaxiVideoSettings;
}> = ({
  hook, settings, label = '知ってた？',
}) => {
  const frame = useCurrentFrame();
  const enter = lerp(frame, [0, 18], [0, 1], EASE.out);

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      padding: `100px ${settings.horizontalPadding}px`,
      gap: 28,
    }}>
      <div style={{
        opacity: enter,
        transform: `scale(${lerp(frame, [0, 18], [0.88, 1], EASE.out)})`,
        width: '92%',
        backgroundColor: settings.hookBandColor,
        paddingInline: 28,
        paddingBlock: 26,
        borderRadius: 4,
        boxShadow: '0 22px 50px rgba(0,0,0,0.42)',
      }}>
        <div style={{ fontFamily: font, color: C.white, fontSize: settings.hookLabelFontSize, fontWeight: 800, letterSpacing: 0, marginBottom: 12, textAlign: 'center' }}>
          {label}
        </div>
        <div style={{
          fontFamily: font,
          color: C.white,
          fontSize: settings.hookFontSize,
          fontWeight: 900,
          lineHeight: 1.25,
          letterSpacing: 0,
          textAlign: 'center',
          textShadow: '0 4px 14px rgba(0,0,0,0.45)',
        }}>
          {hook}
        </div>
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
const CtaCard: React.FC<{
  accentColor: string;
  ctaCard: CtaCardProps;
  settings: TaxiVideoSettings;
}> = ({ accentColor, ctaCard, settings }) => {
  const frame = useCurrentFrame();
  const panel = lerp(frame, [5, 28], [0, 1], EASE.out);
  const numbers = lerp(frame, [18, 44], [0, 1], EASE.out);
  const bullets = lerp(frame, [36, 60], [0, 1], EASE.out);
  const button = lerp(frame, [54, 78], [0, 1], EASE.out);

  return (
    <AbsoluteFill>
      <Img
        src={staticFile('images/video/takuzo-cta-card-bg.png')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{
        position: 'absolute',
        left: settings.horizontalPadding,
        right: settings.horizontalPadding,
        top: 1080,
        transform: `translateY(${lerp(frame, [5, 28], [40, 0], EASE.out)}px)`,
        opacity: panel,
        fontFamily: font,
        color: C.white,
      }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 24 }}>
          {ctaCard.name}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'end',
          gap: 20,
          opacity: numbers,
          marginBottom: 30,
        }}>
          <div>
            <div style={{ color: C.gray[300], fontSize: 24, fontWeight: 700 }}>{ctaCard.beforeLabel}</div>
            <div style={{ color: accentColor, fontSize: 74, fontWeight: 900, lineHeight: 1.1 }}>{ctaCard.beforeValue}</div>
          </div>
          <div style={{ color: accentColor, fontSize: 54, fontWeight: 900, paddingBottom: 8 }}>→</div>
          <div>
            <div style={{ color: C.gray[300], fontSize: 24, fontWeight: 700 }}>{ctaCard.afterLabel}</div>
            <div style={{ color: accentColor, fontSize: 74, fontWeight: 900, lineHeight: 1.1 }}>{ctaCard.afterValue}</div>
          </div>
        </div>

        <div style={{
          opacity: bullets,
          display: 'grid',
          gap: 12,
          fontSize: 36,
          fontWeight: 800,
          lineHeight: 1.35,
          marginBottom: 36,
        }}>
          {ctaCard.bullets.map((bullet) => (
            <div key={bullet}>・{bullet}</div>
          ))}
        </div>

        <div style={{
          opacity: button,
          transform: `translateY(${lerp(frame, [54, 78], [24, 0], EASE.out)}px)`,
          display: 'inline-flex',
          backgroundColor: accentColor,
          color: '#071226',
          borderRadius: 8,
          padding: '20px 34px',
          fontSize: settings.ctaFontSize,
          fontWeight: 900,
          boxShadow: `0 16px 34px ${accentColor}45`,
        }}>
          {ctaCard.ctaText}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 40,
        right: 44,
        fontFamily: font,
        color: C.gray[400],
        fontSize: settings.watermarkFontSize,
        letterSpacing: 1,
        textAlign: 'right',
        lineHeight: 1.6,
      }}>
        TAKUZO TAXI
      </div>
    </AbsoluteFill>
  );
};

const cleanForDisplay = (s: string) => s.replace(/パーセント/g, '％').replace(/%/g, '％').replace(/[、。]/g, '');

const splitSubtitle = (text: string) => {
  const maxLen = 13;
  const clauses = text.split(/(?<=[、。])/).map((c) => cleanForDisplay(c).trim()).filter(Boolean);
  const lines: string[] = [];
  for (const clause of clauses) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + clause.length <= maxLen) {
      lines[lines.length - 1] = last + clause;
    } else if (clause.length <= maxLen) {
      lines.push(clause);
    } else {
      let rest = clause;
      while (rest.length > maxLen) {
        lines.push(rest.slice(0, maxLen));
        rest = rest.slice(maxLen);
      }
      if (rest.length <= 4 && lines.length) lines[lines.length - 1] += rest;
      else if (rest) lines.push(rest);
    }
  }
  if (lines.length >= 2 && lines[lines.length - 1].length <= 4) {
    const tail = lines.pop() as string;
    lines[lines.length - 1] += tail;
  }
  return lines.slice(0, 3);
};

const HighlightedText: React.FC<{
  text: string;
  highlight?: string[];
  accentColor: string;
  fontSize: number;
}> = ({ text, highlight = [], accentColor, fontSize }) => {
  const matches = highlight.filter((word) => word && text.includes(word));
  if (matches.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${matches.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return (
    <>
      {text.split(pattern).map((part, index) => (
        matches.includes(part)
          ? <span key={`${part}-${index}`} style={{ color: accentColor }}>{part}</span>
          : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      ))}
    </>
  );
};

const SegmentTimeline: React.FC<{
  title: string;
  hook: string;
  hookLabel?: string;
  segments: TaxiVideoSegment[];
  accentColor: string;
  bgStyle: BgStyle;
  ctaCard: CtaCardProps;
  settings: TaxiVideoSettings;
}> = ({ hook, hookLabel, segments, accentColor, bgStyle, ctaCard, settings }) => {
  const frame = useCurrentFrame();
  const exactIndex = segments.findIndex((segment) => frame >= segment.startFrame && frame < segment.endFrame);
  const activeIndex = exactIndex >= 0
    ? exactIndex
    : Math.max(0, segments.findIndex((segment) => frame < segment.startFrame) - 1);
  const active = segments[activeIndex] ?? segments.at(-1);
  const previous = segments.slice(0, activeIndex).reverse().find((segment) => segment.imageFile);
  const activeImage = active?.imageFile;
  const local = active ? frame - active.startFrame : 0;
  const fade = Math.min(1, local / 6);
  const imageScale = 1.04 + Math.min(0.08, Math.max(0, local) / 900);

  if (active?.role === 'cta') {
    return <CtaCard accentColor={accentColor} ctaCard={ctaCard} settings={settings} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c1a30', fontFamily: font }}>
      <div style={{
        position: 'absolute',
        inset: '0 0 73% 0',
        backgroundColor: '#0c1a30',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: `40px ${settings.horizontalPadding}px 22px`,
      }}>
        <div style={{ color: accentColor, fontSize: settings.hookLabelFontSize, fontWeight: 900, marginBottom: 16, letterSpacing: 1 }}>
          {hookLabel ?? '求人票の裏側'}
        </div>
        <div style={{
          width: '100%',
          backgroundColor: settings.hookBandColor,
          color: C.white,
          fontSize: settings.hookFontSize,
          fontWeight: 900,
          lineHeight: 1.22,
          textAlign: 'center',
          padding: '24px 30px',
          borderRadius: 4,
          boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
        }}>
          {cleanForDisplay(hook)}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        inset: '27% 0 34% 0',
        overflow: 'hidden',
        backgroundColor: '#111827',
      }}>
        {!activeImage && (
          <BgLayer
            bgStyle={bgStyle}
            imageOpacity={0}
            gradientOpacity={0.25}
          />
        )}
        {previous?.imageFile && activeImage && (
          <Img
            src={staticFile(previous.imageFile)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 1 - fade,
              transform: 'scale(1.08)',
            }}
          />
        )}
        {activeImage && (
          <Img
            src={staticFile(activeImage)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: fade,
              transform: `scale(${imageScale})`,
            }}
          />
        )}
      </div>

      <div style={{
        position: 'absolute',
        inset: '66% 0 0 0',
        backgroundColor: '#0c1a30',
        color: C.white,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: `26px ${settings.horizontalPadding}px 60px`,
      }}>
        <div style={{
          fontSize: settings.infoFontSize + 13,
          fontWeight: 900,
          lineHeight: 1.42,
          textAlign: 'center',
          textShadow: '0 4px 14px rgba(0,0,0,0.35)',
        }}>
          {splitSubtitle(active?.text ?? '').map((line) => (
            <div key={line}>
              <HighlightedText
                text={line}
                highlight={active?.highlight?.map(cleanForDisplay)}
                accentColor={accentColor}
                fontSize={settings.infoFontSize + 13}
              />
            </div>
          ))}
        </div>
        <div style={{
          position: 'absolute',
          right: 44,
          bottom: 34,
          color: C.gray[400],
          fontSize: settings.watermarkFontSize,
          fontWeight: 800,
          letterSpacing: 1,
        }}>
          TAKUZO TAXI
        </div>
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
  narrationSpeed: number;
  bgmVolume: number;
  backgroundImageOpacity: number;
  sceneImageOpacity: number;
  bottomGradientOpacity: number;
  horizontalPadding: number;
  hookBandColor: string;
  hookFontSize: number;
  hookLabelFontSize: number;
  infoFontSize: number;
  infoNumberFontSize: number;
  ctaTitleFontSize: number;
  ctaFontSize: number;
  watermarkFontSize: number;
}

export interface CtaCardProps {
  name: string;
  beforeLabel: string;
  beforeValue: string;
  afterLabel: string;
  afterValue: string;
  bullets: string[];
  ctaText: string;
}

export interface TaxiVideoSegment {
  role: 'hook' | 'body' | 'cta';
  text: string;
  highlight?: string[];
  imageFile?: string;
  startFrame: number;
  endFrame: number;
}

export interface TaxiVideoProps {
  title: string;
  hook: string;
  lines: string[];
  cta: string;
  audioSrc?: string;
  bgmFile?: string;
  bgImageSrc?: string;
  sceneImages?: {
    hook?: string;
    info?: string;
  };
  segments?: TaxiVideoSegment[];
  bgStyle?: BgStyle;
  accentColor?: string;
  hookLabel?: string;
  ctaCard?: Partial<CtaCardProps>;
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
  bgmFile,
  bgImageSrc,
  sceneImages,
  segments,
  bgStyle = 'bokeh',
  accentColor = C.gold,
  hookLabel,
  ctaCard: inputCtaCard,
  timing,
  settings: inputSettings,
}) => {
  const ctaCard: CtaCardProps = {
    name: 'Takuzo（タクゾー）',
    beforeLabel: '営業職',
    beforeValue: '454万',
    afterLabel: 'タクシー1年目',
    afterValue: '814万',
    bullets: ['会社の選び方', '歩合率の見方', '未経験からの働き方'],
    ctaText: '続きはプロフィールから',
    ...inputCtaCard,
  };
  const settings: TaxiVideoSettings = {
    width: 1080,
    height: 1920,
    fps: 30,
    codec: 'h264',
    transitionFrames: 15,
    audioVolume: 1,
    narrationSpeed: 1.08,
    bgmVolume: 0.32,
    backgroundImageOpacity: 0.2,
    sceneImageOpacity: 0.72,
    bottomGradientOpacity: 0.88,
    horizontalPadding: 64,
    hookBandColor: '#E11D2A',
    hookFontSize: 56,
    hookLabelFontSize: 20,
    infoFontSize: 32,
    infoNumberFontSize: 22,
    ctaTitleFontSize: 26,
    ctaFontSize: 26,
    watermarkFontSize: 15,
    ...inputSettings,
  };
  if (segments?.length) {
    const totalFrames = timing?.totalFrames ?? segments.at(-1)?.endFrame ?? 900;
    return (
      <AbsoluteFill style={{ backgroundColor: C.black }}>
        {audioSrc && (
          <Audio
            src={staticFile(audioSrc)}
            volume={settings.audioVolume}
            playbackRate={settings.narrationSpeed}
          />
        )}
        {bgmFile && (
          <BgmTrack
            src={`audio/bgm/${bgmFile}`}
            volume={settings.bgmVolume}
            totalFrames={totalFrames}
            fadeFrames={Math.round(settings.fps * 0.5)}
          />
        )}
        <SegmentTimeline
          title={title}
          hook={hook}
          hookLabel={hookLabel}
          segments={segments}
          accentColor={accentColor}
          bgStyle={bgStyle}
          ctaCard={ctaCard}
          settings={settings}
        />
      </AbsoluteFill>
    );
  }
  const HOOK_FRAMES = timing?.hookFrames ?? 90;
  const INFO_FRAMES = timing?.infoFrames ?? 120;
  const CTA_FRAMES  = timing?.ctaFrames  ?? 90;
  const T = settings.transitionFrames;
  const total = HOOK_FRAMES + INFO_FRAMES + CTA_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: C.black }}>
      {audioSrc && <Audio src={staticFile(audioSrc)} volume={settings.audioVolume} />}
      {bgmFile && (
        <BgmTrack
          src={`audio/bgm/${bgmFile}`}
          volume={settings.bgmVolume}
          totalFrames={timing?.totalFrames ?? total}
          fadeFrames={Math.round(settings.fps * 0.5)}
        />
      )}

      {/* シーン遷移 */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK_FRAMES}>
          <AbsoluteFill>
            <BgLayer
              bgStyle={bgStyle}
              bgImageSrc={sceneImages?.hook ?? bgImageSrc}
              imageOpacity={sceneImages?.hook ? settings.sceneImageOpacity : settings.backgroundImageOpacity}
              gradientOpacity={settings.bottomGradientOpacity}
              kenBurns={Boolean(sceneImages?.hook)}
            />
            <HookScene hook={hook} label={hookLabel} settings={settings} />
          </AbsoluteFill>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={INFO_FRAMES}>
          <AbsoluteFill>
            <BgLayer
              bgStyle={bgStyle}
              bgImageSrc={sceneImages?.info ?? bgImageSrc}
              imageOpacity={sceneImages?.info ? settings.sceneImageOpacity : settings.backgroundImageOpacity}
              gradientOpacity={settings.bottomGradientOpacity}
              kenBurns={Boolean(sceneImages?.info)}
            />
            <InfoScene lines={lines} accentColor={accentColor} lineDelays={timing?.lineDelays} settings={settings} />
          </AbsoluteFill>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={CTA_FRAMES}>
          <CtaCard accentColor={accentColor} ctaCard={ctaCard} settings={settings} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
