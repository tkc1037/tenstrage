import { dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

export async function generateBackground(title, apiKey, outputPath) {
  if (existsSync(outputPath)) return true;

  const prompt = `Cinematic vertical photo for social media short video. ${title.slice(0, 30)}. Tokyo taxi at night, neon city lights reflecting on wet asphalt, dark moody atmosphere, bokeh background, ultra realistic, 4K quality. NO text, NO watermarks.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '9:16' },
      }),
    },
  );
  const json = await response.json();
  if (json.error) {
    console.warn(`⚠️ Imagenエラー（背景なし）: ${json.error.message}`);
    return false;
  }

  const base64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!base64) return false;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(base64, 'base64'));
  return true;
}

export async function generateAudio(text, apiKey, outputPath, voiceName = 'Achird') {
  const directedText =
    '落ち着いた、信頼感のある日本人男性ナレーターとして、' +
    '誇張せず、聞き取りやすい自然な速度で読んでください。\n\n' +
    text;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: directedText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
    },
  );
  const json = await response.json();
  if (json.error) throw new Error(`Gemini TTSエラー: ${json.error.message}`);

  const data = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error('Gemini TTSの音声データがありません');
  const pcm = Buffer.from(data, 'base64');
  const header = Buffer.alloc(44);
  const sampleRate = 24000;
  const channels = 1;
  const bitDepth = 16;
  const byteRate = sampleRate * channels * (bitDepth / 8);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * (bitDepth / 8), 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(outputPath, Buffer.concat([header, pcm]));
}
