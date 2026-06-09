#!/usr/bin/env node
import { resolve } from 'path';
import { rememberReviewCorrections, rememberVideoDefaults } from './review/memory.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/remember-review.js <レビュー.md>');
const reviewPath = resolve(arg);
if (process.argv.includes('--video-defaults')) {
  const defaults = rememberVideoDefaults(reviewPath);
  console.log(`✅ Remotion設定・TTSプロンプト・背景プロンプトを次回の既定値として保存: ${Object.keys(defaults.remotion).length}項目`);
} else {
  const commands = rememberReviewCorrections(reviewPath);
  commands.forEach((command) => console.log(`✅ ${command.type}: ${command.from}${command.to ? ` => ${command.to}` : ''}`));
}
