#!/usr/bin/env node
import assert from 'node:assert/strict';
import { calculateTiming } from './video/timing.js';

const timing = calculateTiming(
  30,
  '転職前に知ってほしい',
  ['収入と歩合', '勤務形態', '会社選び'],
  'フォローしてください',
  { fps: 24, transitionFrames: 12 },
);

assert.equal(timing.totalFrames, 720);
assert.equal(
  timing.hookFrames + timing.infoFrames + timing.ctaFrames - 24,
  timing.totalFrames,
  'TransitionSeriesの実表示尺が音声尺と一致すること',
);
assert.equal(timing.lineDelays.length, 3);
assert.ok(timing.lineDelays.every((delay) => delay >= 0));

console.log('✅ 動画タイミング計算');
