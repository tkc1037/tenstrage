#!/usr/bin/env node
import { basename, join } from 'path';
import { AUDIO_DIR, VIDEO_DIR } from './video/config.js';
import { runVideoQa } from './video/qa.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/check-video.js <slug|video.mp4>');
const slug = basename(arg, '.mp4');
const result = await runVideoQa({
  audioPath: join(AUDIO_DIR, `${slug}.wav`),
  videoPath: join(VIDEO_DIR, `${slug}.mp4`),
});

console.log(JSON.stringify(result, null, 2));
if (result.errors.length > 0) process.exit(1);
