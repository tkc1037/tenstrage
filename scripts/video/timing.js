import { FPS } from './config.js';

export function calculateTiming(audioDurationSec, hook, lines, cta) {
  const transitionFrames = 15;
  const totalFrames = Math.ceil(audioDurationSec * FPS);
  const hookChars = hook.replace(/\s/g, '').length;
  const infoChars = lines.join('').replace(/\s/g, '').length || 1;
  const ctaChars = cta.replace(/\s/g, '').length;
  const totalChars = hookChars + infoChars + ctaChars;
  // TransitionSeriesは遷移時間を前後のSequenceへ重ねる。
  // そのためSequence合計を動画尺+遷移2本分にして、表示尺を音声尺と一致させる。
  const sequenceFrames = totalFrames + transitionFrames * 2;
  const hookFrames = Math.max(60, Math.round((hookChars / totalChars) * sequenceFrames));
  const ctaFrames = Math.max(60, Math.round((ctaChars / totalChars) * sequenceFrames));
  const infoFrames = Math.max(90, sequenceFrames - hookFrames - ctaFrames);

  let cumulativeChars = 0;
  const lineDelays = lines.map((line) => {
    const delay = Math.max(0, Math.round((cumulativeChars / infoChars) * (infoFrames - 30)) - 8);
    cumulativeChars += line.replace(/\s/g, '').length;
    return delay;
  });

  return { hookFrames, infoFrames, ctaFrames, lineDelays, totalFrames };
}
