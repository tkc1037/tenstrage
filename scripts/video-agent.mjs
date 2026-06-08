/**
 * Video Agent
 * 台本 → Gemini TTS音声 → Remotion動画 → X投稿
 *
 * @deprecated 動画生成の正本は generate-video.js。
 * このファイルは過去互換用で、新規運用では使用しない。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ROOT, OBSIDIAN, loadEnv } from './paths.js';

// --- 設定 ---
const env = loadEnv();
const GEMINI_API_KEY = env.GEMINI_API_KEY;
const X_BEARER_TOKEN = env.X_BEARER_TOKEN;
const X_API_KEY = env.X_API_KEY;
const X_API_SECRET = env.X_API_SECRET;
const X_ACCESS_TOKEN = env.X_ACCESS_TOKEN;
const X_ACCESS_TOKEN_SECRET = env.X_ACCESS_TOKEN_SECRET;

// --- Gemini TTS ---
async function generateAudio(script, outputPath) {
  console.log('🎙️ Gemini TTSで音声生成中...');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' }
            }
          }
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini TTS error: ${err}`);
  }

  const data = await res.json();
  const audioB64 = data.candidates[0].content.parts[0].inlineData.data;
  const audioBuffer = Buffer.from(audioB64, 'base64');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, audioBuffer);
  console.log(`✅ 音声保存: ${outputPath}`);
  return outputPath;
}

// --- Remotion レンダリング ---
async function renderVideo(props, audioPath, outputPath) {
  console.log('🎬 Remotionで動画レンダリング中...');

  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');

  const bundleLocation = await bundle({
    entryPoint: join(ROOT, 'src/video/Root.tsx'),
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'TaxiVideo',
    inputProps: { ...props, audioSrc: audioPath ? 'audio/' + audioPath.split('/').pop() : undefined },
  });

  mkdirSync(dirname(outputPath), { recursive: true });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { ...props, audioSrc: audioPath ? 'audio/' + audioPath.split('/').pop() : undefined },
  });

  console.log(`✅ 動画保存: ${outputPath}`);
  return outputPath;
}

// --- X投稿（OAuth 1.0a） ---
async function postToX(text, videoPath) {
  console.log('📤 Xに投稿中...');

  // テキストのみ投稿（動画アップロードはMedia APIが必要）
  const crypto = await import('crypto');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const params = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const bodyParams = { text };
  const allParams = { ...params, ...bodyParams };
  const sortedParams = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const baseString = `POST&${encodeURIComponent('https://api.twitter.com/2/tweets')}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_TOKEN_SECRET)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const authHeader = 'OAuth ' + Object.entries({ ...params, oauth_signature: signature })
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X API error: ${err}`);
  }

  const result = await res.json();
  console.log(`✅ X投稿完了: https://x.com/takuzo_taxi/status/${result.data.id}`);
  return result.data.id;
}

// --- メイン ---
async function runVideoAgent(scriptFile) {
  // 台本ファイル読み込み
  const scriptPath = scriptFile || join(ROOT, 'video-scripts/latest.md');
  const scriptContent = readFileSync(scriptPath, 'utf-8');

  // フロントマターから情報抽出
  const titleMatch = scriptContent.match(/^title:\s*"(.+)"/m);
  const title = titleMatch ? titleMatch[1] : '東京タクシードライバー転職ガイド';

  // 音声用テキスト（マークアップを除去）
  const audioText = scriptContent
    .replace(/---[\s\S]*?---/, '')
    .replace(/\[強調\](.*?)\[\/強調\]/g, '$1')
    .replace(/\[間\]/g, '。')
    .replace(/\[速\](.*?)\[\/速\]/g, '$1')
    .replace(/^#+\s/gm, '')
    .trim();

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const audioPath = join(ROOT, `public/audio/${date}.wav`);
  const videoPath = join(ROOT, `public/videos/${date}.mp4`);

  // ステップ1: TTS音声生成
  await generateAudio(audioText.substring(0, 2000), audioPath);

  // ステップ2: 動画レンダリング
  const lines = audioText.split('\n').filter(l => l.trim() && !l.startsWith('#')).slice(0, 4);
  await renderVideo({ title, lines }, audioPath, videoPath);

  // ステップ3: X投稿
  const tweetText = `${title}\n\n詳しくはプロフのリンクから👇\n#タクシー転職 #東京タクシー #転職`;
  await postToX(tweetText, videoPath);

  console.log('🎉 Video Agent完了!');
}

// 実行
runVideoAgent(process.argv[2]).catch(err => {
  console.error('❌ Video Agent エラー:', err);
  process.exit(1);
});
