#!/usr/bin/env node
/**
 * 台本 → Gemini TTS → Remotion → 自動QA
 *
 * node scripts/generate-video.js <台本.md> [--regenerate-audio] [--skip-background]
 */

import { basename, join } from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { loadEnv } from './paths.js';
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

async function processScript(scriptFile, env, options) {
  const slug = basename(scriptFile, '.md');
  const scriptPath = join(VIDEO_SCRIPTS_DIR, scriptFile);
  const audioPath = join(AUDIO_DIR, `${slug}.wav`);
  const backgroundPath = join(IMAGE_DIR, `${slug}-bg.jpg`);
  const videoPath = join(VIDEO_DIR, `${slug}.mp4`);
  const { parsed, errors } = validateVideoScript(scriptPath);

  if (errors.length > 0) {
    throw new Error(`台本検証エラー:\n- ${errors.join('\n- ')}`);
  }

  console.log(`\n📄 ${scriptFile}`);

  const hasBackground = options.skipBackground
    ? existsSync(backgroundPath)
    : await generateBackground(parsed.title, env.GEMINI_API_KEY, backgroundPath);

  if (options.regenerateAudio || !existsSync(audioPath)) {
    console.log('🎤 Gemini TTS音声生成');
    await generateAudio(
      parsed.plain,
      env.GEMINI_API_KEY,
      audioPath,
      env.GEMINI_TTS_VOICE || 'Achird',
    );
  } else {
    console.log('⚡ 既存音声を利用');
  }

  const wav = inspectWav(audioPath);
  const timing = calculateTiming(wav.durationSeconds, parsed.hook, parsed.lines, parsed.cta);
  const inputProps = {
    title: parsed.title,
    hook: parsed.hook,
    lines: parsed.lines,
    cta: parsed.cta,
    audioSrc: `audio/${basename(audioPath)}`,
    bgImageSrc: hasBackground ? `images/${basename(backgroundPath)}` : undefined,
    bgStyle: parsed.bgStyle,
    accentColor: parsed.accentColor,
    hookLabel: parsed.hookLabel,
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
  console.log(`✅ ${videoPath}`);
  console.log(`🖼️ QA静止画: ${qaDir}`);
  return videoPath;
}

async function main() {
  const env = loadEnv();
  const args = process.argv.slice(2);
  const targetArg = args.find((value) => !value.startsWith('--'));
  const options = {
    regenerateAudio: args.includes('--regenerate-audio'),
    skipBackground: args.includes('--skip-background'),
  };

  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEYが未設定です');
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
