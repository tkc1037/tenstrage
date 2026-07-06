import { readFileSync } from 'fs';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';
import { inspectWav } from './wav.js';

export async function inspectVideo(videoPath) {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new FilePathSource(videoPath),
  });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!videoTrack) throw new Error('映像トラックがありません');
    const packetStats = await videoTrack.computePacketStats(100);
    return {
      durationSeconds: await input.computeDuration(),
      width: await videoTrack.getDisplayWidth(),
      height: await videoTrack.getDisplayHeight(),
      fps: packetStats.averagePacketRate,
      videoCodec: videoTrack.codec,
      audioCodec: audioTrack?.codec ?? null,
      mimeType: await input.getMimeType(),
    };
  } finally {
    input.dispose();
  }
}

export async function runVideoQa({
  audioPath,
  videoPath,
  expected = { width: 1080, height: 1920, fps: 30, codec: 'h264' },
  secrets = [],
  narrationSpeed = 1,
}) {
  const wav = inspectWav(audioPath);
  const video = await inspectVideo(videoPath);
  const errors = [];

  if (wav.sampleRate !== 24000 || wav.channels !== 1 || wav.bitDepth !== 16) {
    errors.push(`WAV仕様不一致: ${wav.sampleRate}Hz/${wav.channels}ch/${wav.bitDepth}bit`);
  }
  if (wav.peak < 100) errors.push('音声が無音または極端に小さい可能性があります');
  if (video.width !== expected.width || video.height !== expected.height) {
    errors.push(`動画解像度不一致: ${video.width}x${video.height}`);
  }
  if (Math.abs(video.fps - expected.fps) > 0.1) errors.push(`FPS不一致: ${video.fps}`);
  const expectedCodec = expected.codec === 'h264' ? 'avc' : expected.codec;
  if (video.videoCodec !== expectedCodec) errors.push(`動画codec不一致: ${video.videoCodec}`);
  const expectedVideoDuration = wav.durationSeconds / narrationSpeed;
  if (Math.abs(video.durationSeconds - expectedVideoDuration) > 1) {
    errors.push(`音声と動画の尺差が大きい: 音声(等速換算)${expectedVideoDuration.toFixed(2)}秒 / 動画${video.durationSeconds.toFixed(2)}秒`);
  }

  const mediaBuffers = [readFileSync(audioPath), readFileSync(videoPath)];
  for (const secret of secrets.filter((value) => value?.length >= 12)) {
    if (mediaBuffers.some((buffer) => buffer.includes(Buffer.from(secret)))) {
      errors.push('生成物に機密値が混入しています');
      break;
    }
  }

  return { wav, video, errors };
}
