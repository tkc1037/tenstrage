#!/usr/bin/env node
/**
 * 承認済みレビュー → Gemini TTS または Remotion → 自動QA
 *
 * node scripts/generate-video.js <台本.md> --audio-only
 * node scripts/generate-video.js <台本.md> --render-only [--skip-background]
 */

import { basename, join } from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { parse } from 'yaml';
import { OBSIDIAN, loadEnv } from './paths.js';
import {
  AUDIO_DIR,
  IMAGE_DIR,
  VIDEO_DIR,
  VIDEO_SCRIPTS_DIR,
} from './video/config.js';
import { validateVideoScript } from './video/parse-script.js';
import { generateAudio, generateBackground } from './video/gemini.js';
import { calculateTiming } from './video/timing.js';
import { inspectWav } from './video/wav.js';
import { createRenderContext, renderQaStills, renderVideo } from './video/render.js';
import { runVideoQa } from './video/qa.js';
import { getCodeBlock, getSection, readReview, updateReviewData } from './review/markdown.js';
import { parseMemoryCommands } from './review/memory.js';

async function processScript(scriptFile, env, options) {
  const slug = basename(scriptFile, '.md');
  const scriptPath = join(VIDEO_SCRIPTS_DIR, scriptFile);
  const audioPath = join(AUDIO_DIR, `${slug}.wav`);
  const backgroundPath = join(IMAGE_DIR, `${slug}-bg.jpg`);
  const videoPath = join(VIDEO_DIR, `${slug}.mp4`);
  const { parsed, errors } = validateVideoScript(scriptPath);
  const reviewPath = join(OBSIDIAN, 'reviews', 'video', `${slug}.md`);

  if (errors.length > 0) {
    throw new Error(`台本検証エラー:\n- ${errors.join('\n- ')}`);
  }

  if (!existsSync(reviewPath)) {
    throw new Error(`レビューがありません。先に実行: node scripts/video-review.js ${scriptFile}`);
  }
  const review = readReview(reviewPath);
  const memoryCommands = parseMemoryCommands(getCodeBlock(getSection(review.body, '記憶する修正')));
  if (memoryCommands.length > 0 && review.data.memoryApplied !== true) {
    throw new Error('恒久修正が未登録です。先に remember-review.js を実行してください');
  }
  const currentHash = createHash('sha256').update(parsed.raw).digest('hex');
  if (review.data.scriptHash !== currentHash) {
    throw new Error('台本がレビュー作成後に変更されています。レビューを更新してください');
  }
  if (review.data.scriptApproved !== true || review.data.speechApproved !== true) {
    throw new Error('scriptApproved と speechApproved の承認が必要です');
  }

  const speechText = getCodeBlock(getSection(review.body, '読み上げ原稿'));
  const display = parse(getCodeBlock(getSection(review.body, '表示設定'))) ?? {};
  const ttsPrompt = getCodeBlock(getSection(review.body, 'TTSプロンプト'));
  const backgroundPrompt = getCodeBlock(getSection(review.body, '背景画像プロンプト'));
  if (!speechText || !ttsPrompt || !backgroundPrompt || !display.hook || !display.cta || !Array.isArray(display.lines)) {
    throw new Error('レビューの表示設定、原稿またはプロンプトが不完全です');
  }

  console.log(`\n📄 ${scriptFile}`);

  if (options.audioOnly) {
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEYが未設定です');
    console.log('🎤 Gemini TTS音声生成');
    await generateAudio(
      speechText,
      env.GEMINI_API_KEY,
      audioPath,
      review.data.voice || env.GEMINI_TTS_VOICE || 'Achird',
      ttsPrompt,
    );
    updateReviewData(reviewPath, {
      status: 'audio-generated',
      audioGeneratedAt: new Date().toISOString(),
      audioApproved: false,
    });
    console.log(`✅ 音声確認待ち: ${audioPath}`);
    return audioPath;
  }

  if (!options.renderOnly) throw new Error('--audio-only または --render-only を指定してください');
  if (review.data.audioApproved !== true || review.data.visualApproved !== true) {
    throw new Error('audioApproved と visualApproved の承認が必要です');
  }
  if (!existsSync(audioPath)) throw new Error('音声がありません。先に --audio-only を実行してください');

  let hasBackground = existsSync(backgroundPath);
  if (!options.skipBackground && !hasBackground) {
    if (!env.GEMINI_API_KEY) throw new Error('背景生成にはGEMINI_API_KEYが必要です');
    hasBackground = await generateBackground(backgroundPrompt, env.GEMINI_API_KEY, backgroundPath);
  }

  const wav = inspectWav(audioPath);
  const timing = calculateTiming(wav.durationSeconds, display.hook, display.lines, display.cta);
  const inputProps = {
    title: display.title,
    hook: display.hook,
    lines: display.lines,
    cta: display.cta,
    audioSrc: `audio/${basename(audioPath)}`,
    bgImageSrc: hasBackground ? `images/${basename(backgroundPath)}` : undefined,
    bgStyle: display.bgStyle,
    accentColor: display.accentColor,
    hookLabel: display.hookLabel,
    timing,
  };

  console.log('🎬 Remotionレンダリング');
  const renderContext = await createRenderContext(inputProps);
  await renderVideo(renderContext, inputProps, videoPath);

  console.log('🔍 自動QA');
  const qa = await runVideoQa({
    audioPath,
    videoPath,
    secrets: [env.GEMINI_API_KEY],
  });
  if (qa.errors.length > 0) throw new Error(`動画QAエラー:\n- ${qa.errors.join('\n- ')}`);

  const qaDir = await renderQaStills(renderContext, inputProps, slug);
  updateReviewData(reviewPath, {
    status: 'video-generated',
    videoGeneratedAt: new Date().toISOString(),
    videoApproved: false,
    publishApproved: false,
  });
  console.log(`✅ ${videoPath}`);
  console.log(`🖼️ QA静止画: ${qaDir}`);
  return videoPath;
}

async function main() {
  const env = loadEnv();
  const args = process.argv.slice(2);
  const targetArg = args.find((value) => !value.startsWith('--'));
  const options = {
    audioOnly: args.includes('--audio-only'),
    renderOnly: args.includes('--render-only'),
    skipBackground: args.includes('--skip-background'),
  };

  if (!options.audioOnly && !options.renderOnly) {
    throw new Error('--audio-only または --render-only を指定してください');
  }
  if (options.audioOnly && options.renderOnly) throw new Error('生成段階は1つずつ指定してください');
  for (const directory of [AUDIO_DIR, IMAGE_DIR, VIDEO_DIR]) {
    mkdirSync(directory, { recursive: true });
  }

  const targets = !targetArg || targetArg === 'all'
    ? readdirSync(VIDEO_SCRIPTS_DIR)
      .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    : [targetArg];

  const failures = [];
  for (const target of targets) {
    try {
      await processScript(target, env, options);
    } catch (error) {
      failures.push(`${target}: ${error.message}`);
      console.error(`❌ ${failures.at(-1)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length}件失敗しました`);
  }
  console.log(`\n🎉 ${targets.length}本完了`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
