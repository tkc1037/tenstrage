#!/usr/bin/env node
import { basename, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { stringify } from 'yaml';
import { OBSIDIAN } from './paths.js';
import { VIDEO_SCRIPTS_DIR } from './video/config.js';
import { validateVideoScript } from './video/parse-script.js';
import { applyContentMemory } from './review/memory.js';
import { writeReview } from './review/markdown.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/video-review.js <台本.md>');
const scriptFile = basename(arg);
const slug = basename(scriptFile, '.md');
const scriptPath = join(VIDEO_SCRIPTS_DIR, scriptFile);
const reviewDir = join(OBSIDIAN, 'reviews', 'video');
const reviewPath = join(reviewDir, `${slug}.md`);
const { parsed, errors } = validateVideoScript(scriptPath);
if (errors.length) throw new Error(errors.join('\n'));
if (existsSync(reviewPath) && !process.argv.includes('--refresh')) {
  throw new Error(`既存レビューを保護しました。更新する場合は --refresh: ${reviewPath}`);
}

mkdirSync(reviewDir, { recursive: true });
const speech = applyContentMemory(parsed.plain, 'video', { pronunciation: true });
const ttsPrompt = [
  '落ち着いた、信頼感のある日本人男性ナレーター。',
  '誇張せず、聞き取りやすい自然な速度で読む。',
  '句読点では自然な間を置く。',
].join('\n');
const backgroundPrompt = `Cinematic vertical photo for social media short video. ${parsed.title}. Tokyo taxi at night, neon city lights reflecting on wet asphalt, dark moody atmosphere, bokeh background, ultra realistic. NO text, NO watermarks.`;
const scriptHash = createHash('sha256').update(parsed.raw).digest('hex');

const body = `# 動画公開前レビュー：${parsed.title}

> このファイルを直接編集してください。承認欄をtrueにするまで次工程は停止します。

## 表示設定

\`\`\`yaml
${stringify({
  title: parsed.title,
  hook: parsed.hook,
  lines: parsed.lines,
  cta: parsed.cta,
  bgStyle: parsed.bgStyle,
  accentColor: parsed.accentColor,
  hookLabel: parsed.hookLabel,
}, { lineWidth: 0 }).trim()}
\`\`\`

## 読み上げ原稿

\`\`\`text
${speech}
\`\`\`

## TTSプロンプト

\`\`\`text
${ttsPrompt}
\`\`\`

## 背景画像プロンプト

\`\`\`text
${backgroundPrompt}
\`\`\`

## YouTubeタイトル

\`\`\`text
${parsed.title}
\`\`\`

## YouTube本文

\`\`\`text
${parsed.cta}

#タクシー転職 #タクシードライバー #東京タクシー
\`\`\`

## TikTok本文

\`\`\`text
${parsed.hook}

${parsed.cta}

#タクシー転職 #タクシードライバー #東京タクシー
\`\`\`

## 記憶する修正

必要な行だけ追加します。

\`\`\`text
# - reading: 営収 => えいしゅう
# - video: 修正前の表現 => 修正後の表現
# - global: 全媒体の修正前 => 全媒体の修正後
# - avoid-video: 使用しない表現
\`\`\`

## 確認手順

1. 表示設定・読み上げ原稿・各プロンプトを修正
2. 恒久修正があれば「記憶する修正」へ記載
3. 台本と音声を承認したら \`scriptApproved\` と \`speechApproved\` をtrue
4. 音声試聴後に \`audioApproved\` をtrue
5. 背景・映像方針確認後に \`visualApproved\` をtrue
6. 動画確認後に \`videoApproved\`、公開直前に \`publishApproved\` をtrue
`;

writeReview(reviewPath, {
  type: 'video-review',
  source: `video-scripts/${scriptFile}`,
  slug,
  scriptHash,
  status: 'draft',
  scriptApproved: false,
  speechApproved: false,
  audioApproved: false,
  visualApproved: false,
  videoApproved: false,
  publishApproved: false,
  factChecked: false,
  memoryApplied: false,
  youtubePublished: false,
  tiktokPublished: false,
  voice: 'Achird',
  createdAt: new Date().toISOString(),
}, body);

console.log(reviewPath);
