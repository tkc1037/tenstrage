#!/usr/bin/env node
/**
 * generate-video.js — 台本→TTS音声→Remotion動画 自動生成
 *
 * 実行: node scripts/generate-video.js [script-file]
 * 例:   node scripts/generate-video.js 20260529-fares-raise-income-up.md
 *       node scripts/generate-video.js 20260529-fares-raise-income-up.md --regenerate-audio
 *       node scripts/generate-video.js all  ← video-scripts/ 全件処理
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { ROOT, OBSIDIAN, loadEnv } from './paths.js';

const SCRIPTS_DIR = join(ROOT, 'video-scripts');
const OUTPUT_DIR = join(ROOT, 'public', 'video');
const AUDIO_DIR = join(ROOT, 'public', 'audio');

// ─── 台本パース ──────────────────────────────────────────
function parseScript(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const withoutFrontmatter = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  // タイトル抽出（# タイトル 行）
  const titleMatch = raw.match(/^# (.+)$/m);
  const title = titleMatch?.[1] ?? basename(filePath, '.md');

  const stripMarks = s => s
    .replace(/\[強調\](.*?)\[\/強調\]/g, '$1')
    .replace(/\[速\](.*?)\[\/速\]/g, '$1')
    .replace(/\[間\]/g, '')
    .replace(/\*\*/g, '')
    .trim();

  // hook抽出: frontmatter > ### フック内の[強調]テキスト > タイトル
  const hookFm = raw.match(/^hook:\s*["']?(.+?)["']?\s*$/m);
  const hookEmphasis = raw.match(/### フック[\s\S]*?\[強調\](.*?)\[\/強調\]/);
  const hookSection = raw.match(/###\s*フック[^\n]*\n+([^\n#]+)/);
  const hook = hookFm?.[1]
    ?? (hookEmphasis ? stripMarks(hookEmphasis[1]) : null)
    ?? (hookSection ? stripMarks(hookSection[1]) : null)
    ?? title;

  // cta抽出: frontmatter > ### CTA内の最初の短い文
  const ctaFm = raw.match(/^cta:\s*["']?(.+?)["']?\s*$/m);
  const ctaSection = raw.match(/###\s*CTA[^\n]*\n+([\s\S]*?)(?=\n---|\n##|$)/);
  const ctaRaw = ctaFm?.[1] ?? (ctaSection
    ? ctaSection[1].split('\n').map(l => stripMarks(l)).filter(Boolean)[0]
    : null);
  const cta = ctaRaw?.slice(0, 30) ?? 'プロフのリンクをチェック👆';

  // マーク除去したプレーンテキスト（TTS用）
  const plain = withoutFrontmatter
    .replace(/\[強調\](.*?)\[\/強調\]/g, '$1')
    .replace(/\[速\](.*?)\[\/速\]/g, '$1')
    .replace(/\[間\]/g, ' ')
    .replace(/^#.*$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/---/g, '')
    .trim();

  // lines抽出: ### 本編 内の[強調]テキストを優先、なければ短い非空行
  const honpen = raw.match(/###\s*本編[\s\S]*?(?=\n###|\n##|$)/)?.[0] ?? '';
  const emphasisLines = [...honpen.matchAll(/\[強調\](.*?)\[\/強調\]/g)]
    .map(m => m[1].trim())
    .filter(Boolean)
    .slice(0, 4);
  const fallbackLines = honpen
    .split('\n')
    .map(l => stripMarks(l))
    .filter(l => l && !l.startsWith('#') && !l.startsWith('[') && l.length > 5)
    .slice(0, 4);
  const lines = emphasisLines.length >= 2 ? emphasisLines : fallbackLines;

  // frontmatter拡張フィールド
  const bgStyleFm = raw.match(/^bgStyle:\s*["']?(\w+)["']?\s*$/m);
  const bgStyle = bgStyleFm?.[1] ?? 'bokeh';

  const accentColorFm = raw.match(/^accentColor:\s*["']?([^"'\n]+?)["']?\s*$/m);
  const accentColor = accentColorFm?.[1] ?? undefined;

  const hookLabelFm = raw.match(/^hookLabel:\s*["']?(.+?)["']?\s*$/m);
  const hookLabel = hookLabelFm?.[1] ?? undefined;

  // titleはfrontmatterを優先
  const titleFm = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const resolvedTitle = titleFm?.[1] ?? title;

  return { title: resolvedTitle, hook, cta, plain, lines, bgStyle, accentColor, hookLabel };
}

// ─── Gemini Imagen 背景画像生成 ──────────────────────────
async function generateBackground(title, apiKey, outputPath) {
  if (existsSync(outputPath)) {
    console.log(`⚡ 背景画像キャッシュ利用: ${outputPath}`);
    return true;
  }
  console.log('🖼️  Gemini Imagen 背景画像生成中...');

  // タクシー系SNS競合風: 夜の東京・タクシー・ネオン
  const prompt = `Cinematic vertical photo for social media short video. ${title.slice(0, 30)}. Tokyo taxi at night, neon city lights reflecting on wet asphalt, dark moody atmosphere, bokeh background, ultra realistic, 4K quality. NO text, NO watermarks.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '9:16' },
      }),
    }
  );

  const json = await res.json();
  if (json.error) {
    console.warn(`⚠️  Imagen エラー（背景なし）: ${json.error.message}`);
    return false;
  }

  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) {
    console.warn('⚠️  Imagen: 画像データなし（背景なし）');
    return false;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(b64, 'base64'));
  console.log(`✅ 背景画像保存: ${outputPath}`);
  return true;
}

// ─── Gemini TTS 音声生成 ─────────────────────────────────
async function generateAudio(text, apiKey, outputPath, voiceName = 'Achird') {
  console.log('🎤 Gemini TTS 音声生成中...');
  const directedText =
    '落ち着いた、信頼感のある日本人男性ナレーターとして、' +
    '誇張せず、聞き取りやすい自然な速度で読んでください。\n\n' +
    text;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: directedText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    }
  );

  const json = await res.json();

  if (json.error) {
    throw new Error(`Gemini TTS エラー: ${json.error.message}`);
  }

  const part = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) throw new Error(`音声データなし: ${JSON.stringify(json).slice(0, 200)}`);

  const pcm = Buffer.from(part.data, 'base64');

  // PCM16 → WAV ヘッダー付加（Gemini TTS デフォルト: 24kHz, mono, 16bit）
  const sampleRate = 24000;
  const channels = 1;
  const bitDepth = 16;
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);           // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  writeFileSync(outputPath, Buffer.concat([header, pcm]));
  console.log(`✅ 音声保存: ${outputPath}`);
}

// ─── WAV duration 取得（ヘッダーから計算） ──────────────
function getWavDuration(filePath) {
  const buf = readFileSync(filePath);
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') byteRate = buf.readUInt32LE(offset + 16);
    if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!byteRate || !dataSize) throw new Error(`WAV形式を解析できません: ${filePath}`);
  return dataSize / byteRate;
}

// ─── 音声長 → テロップ同期タイミング計算 ───────────────
function calcTiming(audioDurationSec, hook, lines, cta) {
  const FPS = 30;
  const T   = 15; // transition frames
  const totalFrames = Math.ceil(audioDurationSec * FPS);

  // 各セクションの文字数（空白除く）
  const hookChars = hook.replace(/\s/g, '').length;
  const infoChars = lines.join('').replace(/\s/g, '').length || 1;
  const ctaChars  = cta.replace(/\s/g, '').length;
  const totalChars = hookChars + infoChars + ctaChars;

  // トランジション分を除いた利用可能フレームを文字数比率で配分
  const avail = totalFrames - T * 2;
  const hookFrames = Math.max(60, Math.round((hookChars / totalChars) * avail));
  const ctaFrames  = Math.max(60, Math.round((ctaChars  / totalChars) * avail));
  const infoFrames = Math.max(90, avail - hookFrames - ctaFrames);

  // InfoScene内：各行の表示タイミング（文字数比率 × infoFrames）
  // テロップは音声より少し早め(-8f)に出して視認性を確保
  const LEAD = 8;
  let cumChars = 0;
  const lineDelays = lines.map(line => {
    const delay = Math.max(0, Math.round((cumChars / infoChars) * (infoFrames - 30)) - LEAD);
    cumChars += line.replace(/\s/g, '').length;
    return delay;
  });

  console.log(`⏱  音声: ${audioDurationSec.toFixed(1)}s → Hook:${hookFrames}f Info:${infoFrames}f CTA:${ctaFrames}f`);
  return { hookFrames, infoFrames, ctaFrames, lineDelays, totalFrames };
}

// ─── Remotion レンダリング ───────────────────────────────
async function renderVideo(props, outputPath) {
  console.log('🎬 Remotion 動画レンダリング中...');

  const bundled = await bundle({
    entryPoint: join(ROOT, 'src', 'video', 'Root.tsx'),
    webpackOverride: (config) => config,
  });

  // bgStyleに対応したcomposition IDを選択
  const bgStyleToId = {
    bokeh: 'TaxiVideo',
    aurora: 'TaxiVideo-Aurora',
    waves: 'TaxiVideo-Waves',
    grid: 'TaxiVideo-Grid',
    geometric: 'TaxiVideo-Geometric',
    gradient: 'TaxiVideo-Gradient',
  };
  const compositionId = bgStyleToId[props.bgStyle] ?? 'TaxiVideo';

  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: props,
  });

  // 音声長に合わせてcompositionのdurationを上書き
  const finalComposition = props.timing
    ? { ...composition, durationInFrames: props.timing.totalFrames }
    : composition;

  await renderMedia({
    composition: finalComposition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: props,
  });

  console.log(`✅ 動画保存: ${outputPath}`);
}

// ─── 1本処理 ────────────────────────────────────────────
async function processScript(scriptFile, env, options) {
  const slug = basename(scriptFile, '.md');
  const audioPath = join(AUDIO_DIR, `${slug}.wav`);
  const bgPath = join(ROOT, 'public', 'images', `${slug}-bg.jpg`);
  const videoPath = join(OUTPUT_DIR, `${slug}.mp4`);

  console.log(`\n📄 処理: ${scriptFile}`);

  const { title, hook, cta, plain, lines, bgStyle, accentColor, hookLabel } = parseScript(join(SCRIPTS_DIR, scriptFile));

  // 背景画像生成（Gemini Imagen）
  const hasBg = options.skipBackground
    ? existsSync(bgPath)
    : await generateBackground(title, env.GEMINI_API_KEY, bgPath);

  // TTS音声生成
  if (options.regenerateAudio || !existsSync(audioPath)) {
    await generateAudio(plain, env.GEMINI_API_KEY, audioPath, env.GEMINI_TTS_VOICE || 'Achird');
  } else {
    console.log(`⚡ 音声キャッシュ利用: ${audioPath}`);
  }

  // 音声長からタイミング計算
  const audioDuration = getWavDuration(audioPath);
  const timing = calcTiming(audioDuration, hook, lines, cta);

  // Remotionレンダリング
  const inputProps = {
    title,
    hook,
    lines,
    cta,
    audioSrc: `audio/${basename(audioPath)}`,
    bgImageSrc: hasBg ? `images/${basename(bgPath)}` : undefined,
    bgStyle,
    ...(accentColor ? { accentColor } : {}),
    ...(hookLabel ? { hookLabel } : {}),
    timing,
  };
  await renderVideo(inputProps, videoPath);

  return videoPath;
}

// ─── メイン ──────────────────────────────────────────────
async function main() {
  const env = loadEnv();
  const args = process.argv.slice(2);
  const arg = args.find((value) => !value.startsWith('--'));
  const options = {
    regenerateAudio: args.includes('--regenerate-audio'),
    skipBackground: args.includes('--skip-background'),
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(AUDIO_DIR, { recursive: true });

  if (!env.GEMINI_API_KEY) { console.error('❌ GEMINI_API_KEY が未設定'); process.exit(1); }

  let targets = [];
  if (!arg || arg === 'all') {
    targets = readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.md'));
    console.log(`📂 全台本処理: ${targets.length}件`);
  } else {
    targets = [arg];
  }

  const videos = [];
  for (const f of targets) {
    try {
      const videoPath = await processScript(f, env, options);
      videos.push(videoPath);
    } catch (e) {
      console.error(`❌ ${f} 失敗: ${e.message}`);
    }
  }

  console.log(`\n🎉 完了: ${videos.length}本の動画を生成しました`);
  videos.forEach(v => console.log(`  ${v}`));
}

main().catch(e => { console.error('❌', e); process.exit(1); });
