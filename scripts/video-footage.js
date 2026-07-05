#!/usr/bin/env node
import { basename, join } from 'path';
import { existsSync } from 'fs';
import { OBSIDIAN, loadEnv } from './paths.js';
import { VIDEO_SCRIPTS_DIR } from './video/config.js';
import { validateVideoScript } from './video/parse-script.js';
import { readReview } from './review/markdown.js';
import { createFootageReview } from './video/footage.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/video-footage.js <台本.md>');

const env = loadEnv();
const scriptFile = basename(arg);
const slug = basename(scriptFile, '.md');
const scriptPath = join(VIDEO_SCRIPTS_DIR, scriptFile);
const reviewPath = join(OBSIDIAN, 'reviews', 'video', `${slug}.md`);
const { parsed, errors } = validateVideoScript(scriptPath);
if (errors.length) throw new Error(errors.join('\n'));
if (!existsSync(reviewPath)) {
  throw new Error(`レビューがありません。先に実行: node scripts/video-review.js ${scriptFile}`);
}
if (!env.PEXELS_API_KEY && !env.UNSPLASH_ACCESS_KEY) {
  throw new Error('PEXELS_API_KEY または UNSPLASH_ACCESS_KEY が必要です');
}

const review = readReview(reviewPath);
const result = await createFootageReview({ parsed, slug, review, reviewPath, env });
console.log(`実写候補を作成しました: ${result.contactSheet}`);
