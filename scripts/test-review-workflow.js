#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'path';
import { parse } from 'yaml';
import { OBSIDIAN } from './paths.js';
import { applyContentMemory, loadContentMemory, parseMemoryCommands } from './review/memory.js';
import { getCodeBlock, getSection, readReview } from './review/markdown.js';
import { validateXText } from './review/x.js';
import { validateRemotionSettings } from './video/settings.js';

const videoReview = readReview(join(OBSIDIAN, 'reviews', 'video', '20260608-first-introduction.md'));
const display = parse(getCodeBlock(getSection(videoReview.body, '表示設定')));
assert.equal(videoReview.data.type, 'video-review');
assert.equal(videoReview.data.scriptApproved, false);
assert.ok(display.hook);
assert.ok(Array.isArray(display.lines));
assert.ok(getCodeBlock(getSection(videoReview.body, '読み上げ原稿')));
const remotion = parse(getCodeBlock(getSection(videoReview.body, 'Remotion設定')));
assert.equal(validateRemotionSettings(remotion).errors.length, 0);
assert.equal(videoReview.data.remotionApproved, false);
assert.equal(videoReview.data.ttsPromptApproved, false);
assert.equal(videoReview.data.backgroundPromptApproved, false);
assert.equal(loadContentMemory().videoDefaults.remotion.width, 1080);

const xReview = readReview(join(OBSIDIAN, 'reviews', 'x', 'x-20260608-001.md'));
const xText = getCodeBlock(getSection(xReview.body, '投稿本文'));
assert.equal(xReview.data.type, 'x-review');
assert.ok(validateXText(xText).length > 0);

assert.equal(
  applyContentMemory('営収と隔日勤務、羽田の迎車', 'video', { pronunciation: true }),
  'えいしゅうとかくじつきんむ、はねだのげいしゃ',
);
assert.deepEqual(
  parseMemoryCommands('- reading: 営収 => えいしゅう\n# - x: 無視 => 無視\n- avoid-x: 絶対'),
  [
    { type: 'reading', from: '営収', to: 'えいしゅう' },
    { type: 'avoid-x', from: '絶対', to: undefined },
  ],
);

console.log('✅ レビュー・承認・読み方記憶');
