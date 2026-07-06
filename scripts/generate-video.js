#!/usr/bin/env node
/**
 * 承認済みレビュー → Gemini TTS または Remotion → 自動QA
 *
 * node scripts/generate-video.js <台本.md> --audio-only
 * node scripts/generate-video.js <台本.md> --render-only [--skip-background]
 */

import { basename, join } from 'path';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { parse } from 'yaml';
import { OBSIDIAN, loadEnv } from './paths.js';
import {
  AUDIO_DIR,
  IMAGE_DIR,
  VIDEO_DIR,
  VIDEO_SCRIPTS_DIR,
  BGM_TRACKS,
} from './video/config.js';
import { resolveApprovedFootage } from './video/footage.js';
import { validateVideoScript } from './video/parse-script.js';
import { generateAudio, generateBackground } from './video/gemini.js';
import { calculateTiming } from './video/timing.js';
import { validateRemotionSettings } from './video/settings.js';
import { inspectWav } from './video/wav.js';
import { createRenderContext, renderQaStills, renderVideo } from './video/render.js';
import { runVideoQa } from './video/qa.js';
import { getCodeBlock, getSection, readReview, updateReviewData } from './review/markdown.js';
import { applyContentMemory, parseMemoryCommands } from './review/memory.js';

const SEGMENT_PAUSE_SECONDS = 0.2;

function wavData(filePath) {
  const buffer = readFileSync(filePath);
  let offset = 12;
  let fmt = null;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      fmt = {
        channels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        bitDepth: buffer.readUInt16LE(offset + 22),
      };
    }
    if (chunkId === 'data') {
      if (!fmt) throw new Error(`WAV fmtチャンクがありません: ${filePath}`);
      return { ...fmt, data: buffer.subarray(offset + 8, offset + 8 + chunkSize) };
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error(`WAV dataチャンクがありません: ${filePath}`);
}

function writePcmWav(outputPath, chunks, format) {
  const dataSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const header = Buffer.alloc(44);
  const byteRate = format.sampleRate * format.channels * (format.bitDepth / 8);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(format.channels, 22);
  header.writeUInt32LE(format.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(format.channels * (format.bitDepth / 8), 32);
  header.writeUInt16LE(format.bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  writeFileSync(outputPath, Buffer.concat([header, ...chunks]));
}

function buildSegmentTimeline(segments, segmentAudioPaths, outputPath, fps, narrationSpeed = 1) {
  const chunks = [];
  let format = null;
  let currentFrame = 0;
  const timeline = [];

  segmentAudioPaths.forEach((audioFile, index) => {
    const wav = inspectWav(audioFile);
    const data = wavData(audioFile);
    format ??= {
      channels: data.channels,
      sampleRate: data.sampleRate,
      bitDepth: data.bitDepth,
    };
    if (
      data.channels !== format.channels
      || data.sampleRate !== format.sampleRate
      || data.bitDepth !== format.bitDepth
    ) {
      throw new Error(`セグメント音声のWAV形式が揃っていません: ${audioFile}`);
    }
    const durationFrames = Math.max(1, Math.ceil((wav.durationSeconds / narrationSpeed) * fps));
    const startFrame = currentFrame;
    const endFrame = startFrame + durationFrames;
    timeline.push({
      ...segments[index],
      startFrame,
      endFrame,
    });
    chunks.push(data.data);
    currentFrame = endFrame;
    if (index < segmentAudioPaths.length - 1) {
      const silenceBytes = Math.round(format.sampleRate * SEGMENT_PAUSE_SECONDS) * format.channels * (format.bitDepth / 8);
      chunks.push(Buffer.alloc(silenceBytes));
      currentFrame += Math.round((SEGMENT_PAUSE_SECONDS / narrationSpeed) * fps);
    }
  });

  writePcmWav(outputPath, chunks, format);
  return {
    segments: timeline,
    totalFrames: currentFrame,
  };
}

function segmentImageFile(slug, index) {
  return `images/video/${slug}/seg-${String(index + 1).padStart(2, '0')}.jpg`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelayMs(error) {
  const message = error?.message ?? '';
  const match = message.match(/retry in ([\d.]+)s/i);
  if (match) return Math.ceil(Number.parseFloat(match[1]) * 1000) + 3000;
  if (/quota|rate/i.test(message)) return 45000;
  return 0;
}

async function generateAudioWithRetry(...args) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await generateAudio(...args);
      return;
    } catch (error) {
      const delay = retryDelayMs(error);
      if (!delay || attempt === 2) throw error;
      console.warn(`⚠️ TTSクォータ待機: ${Math.round(delay / 1000)}秒`);
      await sleep(delay);
    }
  }
}

async function generateBackgroundWithRetry(...args) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await generateBackground(...args);
    } catch (error) {
      const delay = retryDelayMs(error);
      if (!delay || attempt === 2) throw error;
      console.warn(`⚠️ Imagenクォータ待機: ${Math.round(delay / 1000)}秒`);
      await sleep(delay);
    }
  }
  return false;
}

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
  if (
    review.data.scriptApproved !== true
    || review.data.speechApproved !== true
    || review.data.ttsPromptApproved !== true
  ) {
    throw new Error('scriptApproved、speechApproved、ttsPromptApprovedの承認が必要です');
  }

  const speechText = getCodeBlock(getSection(review.body, '読み上げ原稿'));
  const display = parse(getCodeBlock(getSection(review.body, '表示設定'))) ?? {};
  const segmentReview = parse(getCodeBlock(getSection(review.body, 'セグメント'))) ?? {};
  const segments = Array.isArray(segmentReview.segments) ? segmentReview.segments : parsed.segments;
  const hasSegments = segments.length > 0;
  const remotionInput = parse(getCodeBlock(getSection(review.body, 'Remotion設定'))) ?? {};
  const { settings, errors: settingsErrors } = validateRemotionSettings(remotionInput);
  const ttsPrompt = getCodeBlock(getSection(review.body, 'TTSプロンプト'));
  const backgroundPrompt = getCodeBlock(getSection(review.body, '背景画像プロンプト'));
  if (settingsErrors.length > 0) throw new Error(`Remotion設定エラー:\n- ${settingsErrors.join('\n- ')}`);
  if (!speechText || !ttsPrompt || (!hasSegments && !backgroundPrompt) || !display.hook || !display.cta || !Array.isArray(display.lines)) {
    throw new Error('レビューの表示設定、原稿またはプロンプトが不完全です');
  }

  console.log(`\n📄 ${scriptFile}`);

  if (options.audioOnly) {
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEYが未設定です');
    if (hasSegments && review.data.segmentPromptsApproved !== true) {
      throw new Error('segmentPromptsApprovedの承認が必要です');
    }
    if (hasSegments) {
      console.log(`🎤 セグメント別Gemini TTS音声生成: ${segments.length}件`);
      const segmentAudioDir = join(AUDIO_DIR, slug);
      mkdirSync(segmentAudioDir, { recursive: true });
      const segmentAudioPaths = [];
      for (const [index, segment] of segments.entries()) {
        const outputPath = join(segmentAudioDir, `seg-${String(index + 1).padStart(2, '0')}.wav`);
        if (!existsSync(outputPath)) {
          const readingText = applyContentMemory(segment.text, 'video', { pronunciation: true });
          await generateAudioWithRetry(
            readingText,
            env.GEMINI_API_KEY,
            outputPath,
            review.data.voice || env.GEMINI_TTS_VOICE || 'Achird',
            ttsPrompt,
          );
        }
        segmentAudioPaths.push(outputPath);
      }
      const timeline = buildSegmentTimeline(segments, segmentAudioPaths, audioPath, settings.fps, settings.narrationSpeed);
      const imageSegments = timeline.segments.filter((segment) => segment.role !== 'cta');
      if (!options.skipBackground) {
        console.log(`🖼️ Gemini Imagen差し込み画像生成: ${imageSegments.length}件`);
        for (const [index, segment] of timeline.segments.entries()) {
          if (segment.role === 'cta') continue;
          const imageFile = segmentImageFile(slug, index);
          const ok = await generateBackgroundWithRetry(segment.imagePrompt, env.GEMINI_API_KEY, join(IMAGE_DIR, imageFile.replace(/^images\//, '')), '4:3');
          segment.imageFile = ok ? imageFile : undefined;
        }
      }
      updateReviewData(reviewPath, {
        status: 'segment-assets-generated',
        audioGeneratedAt: new Date().toISOString(),
        segmentTimeline: timeline.segments,
        totalFrames: timeline.totalFrames,
        audioApproved: false,
        visualApproved: false,
      });
      console.log(`✅ 音声・差し込み画像確認待ち: ${audioPath}`);
      return audioPath;
    }
    console.log('🎤 Gemini TTS音声生成');
    await generateAudio(
      applyContentMemory(speechText, 'video', { pronunciation: true }),
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
  if (
    review.data.audioApproved !== true
    || review.data.visualApproved !== true
    || (!hasSegments && review.data.backgroundPromptApproved !== true)
    || (hasSegments && review.data.segmentPromptsApproved !== true)
    || review.data.remotionApproved !== true
  ) {
    throw new Error(`audioApproved、visualApproved、${hasSegments ? 'segmentPromptsApproved' : 'backgroundPromptApproved'}、remotionApprovedの承認が必要です`);
  }
  if (!existsSync(audioPath)) throw new Error('音声がありません。先に --audio-only を実行してください');
  if (hasSegments && !Array.isArray(review.data.segmentTimeline)) {
    throw new Error('セグメントタイムラインがありません。先に --audio-only でセグメント音声・画像を生成してください');
  }

  let hasBackground = !hasSegments && existsSync(backgroundPath);
  if (!hasSegments && !options.skipBackground && !hasBackground) {
    if (!env.GEMINI_API_KEY) throw new Error('背景生成にはGEMINI_API_KEYが必要です');
    hasBackground = await generateBackground(backgroundPrompt, env.GEMINI_API_KEY, backgroundPath);
  }

  const wav = inspectWav(audioPath);
  const timing = hasSegments
    ? { totalFrames: review.data.totalFrames ?? Math.ceil(wav.durationSeconds * settings.fps) }
    : calculateTiming(wav.durationSeconds, display.hook, display.lines, display.cta, settings);
  const sceneImages = hasSegments ? undefined : await resolveApprovedFootage({
    slug,
    review,
    env,
  });
  const bgmKey = display.bgm || parsed.bgm || 'main';
  const bgmFile = BGM_TRACKS[bgmKey];
  if (!bgmFile) throw new Error(`BGM設定が不正です: ${bgmKey}`);
  const inputProps = {
    title: display.title,
    hook: display.hook,
    lines: display.lines,
    cta: display.cta,
    audioSrc: `audio/${basename(audioPath)}`,
    bgmFile,
    bgImageSrc: hasBackground ? `images/${basename(backgroundPath)}` : undefined,
    sceneImages,
    segments: hasSegments ? review.data.segmentTimeline : undefined,
    bgStyle: display.bgStyle,
    accentColor: display.accentColor,
    hookLabel: display.hookLabel,
    timing,
    settings,
  };

  console.log('🎬 Remotionレンダリング');
  const renderContext = await createRenderContext(inputProps);
  await renderVideo(renderContext, inputProps, videoPath, settings.codec);

  console.log('🔍 自動QA');
  const qa = await runVideoQa({
    audioPath,
    videoPath,
    expected: settings,
    secrets: [env.GEMINI_API_KEY],
    narrationSpeed: hasSegments ? settings.narrationSpeed : 1,
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
