import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface TaxiVideoProps {
  title: string;
  lines: string[];
  audioSrc?: string;
}

export const TaxiVideo: React.FC<TaxiVideoProps> = ({ title, lines, audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 30], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e', fontFamily: 'Noto Sans JP, sans-serif' }}>
      {audioSrc && <Audio src={staticFile(audioSrc)} />}

      {/* Background gradient */}
      <AbsoluteFill style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
      }} />

      {/* Title */}
      <Sequence from={0} durationInFrames={durationInFrames}>
        <AbsoluteFill style={{
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          padding: '60px 80px',
        }}>
          <div style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            backgroundColor: '#e94560',
            padding: '12px 24px',
            borderRadius: '4px',
            marginBottom: '40px',
          }}>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              東京タクシードライバー転職ガイド
            </span>
          </div>

          <h1 style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            color: 'white',
            fontSize: 52,
            fontWeight: 'bold',
            lineHeight: 1.3,
            margin: 0,
            maxWidth: 900,
          }}>
            {title}
          </h1>
        </AbsoluteFill>
      </Sequence>

      {/* Content lines */}
      {lines.map((line, i) => {
        const startFrame = 60 + i * 45;
        const lineOpacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const lineX = interpolate(frame, [startFrame, startFrame + 20], [-30, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames - startFrame}>
            <AbsoluteFill style={{
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '0 80px',
              paddingTop: 280 + i * 70,
            }}>
              <div style={{
                opacity: lineOpacity,
                transform: `translateX(${lineX}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#e94560', flexShrink: 0 }} />
                <span style={{ color: '#e0e0e0', fontSize: 28, lineHeight: 1.5 }}>{line}</span>
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* CTA */}
      <Sequence from={durationInFrames - 90} durationInFrames={90}>
        <AbsoluteFill style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 0 60px 0',
        }}>
          <div style={{
            opacity: interpolate(frame, [durationInFrames - 90, durationInFrames - 60], [0, 1], { extrapolateRight: 'clamp' }),
            backgroundColor: '#e94560',
            padding: '16px 40px',
            borderRadius: '8px',
          }}>
            <span style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>
              プロフのリンクから詳細を確認
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
