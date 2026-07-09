export const DEFAULT_REMOTION_SETTINGS = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  codec: 'h264',
  transitionFrames: 15,
  audioVolume: 1,
  narrationSpeed: 1.25,
  bgmVolume: 0.32,
  backgroundImageOpacity: 0.2,
  sceneImageOpacity: 0.72,
  bottomGradientOpacity: 0.88,
  horizontalPadding: 64,
  hookBandColor: '#e11d2a',
  hookFontSize: 56,
  hookLabelFontSize: 20,
  infoFontSize: 32,
  infoNumberFontSize: 22,
  ctaTitleFontSize: 26,
  ctaFontSize: 26,
  watermarkFontSize: 15,
});

const ranges = {
  width: [720, 2160],
  height: [1280, 3840],
  transitionFrames: [1, 45],
  audioVolume: [0, 2],
  narrationSpeed: [1, 1.3],
  bgmVolume: [0, 1],
  backgroundImageOpacity: [0, 1],
  sceneImageOpacity: [0, 1],
  bottomGradientOpacity: [0, 1],
  horizontalPadding: [24, 160],
  hookFontSize: [24, 120],
  hookLabelFontSize: [12, 48],
  infoFontSize: [18, 72],
  infoNumberFontSize: [12, 48],
  ctaTitleFontSize: [16, 64],
  ctaFontSize: [16, 72],
  watermarkFontSize: [10, 32],
};

function validateNumber(settings, key, errors) {
  const [min, max] = ranges[key];
  const value = settings[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors.push(`${key}は${min}〜${max}の数値で指定してください`);
  }
}

export function validateRemotionSettings(input = {}) {
  const settings = { ...DEFAULT_REMOTION_SETTINGS, ...(input ?? {}) };
  const errors = [];

  for (const key of Object.keys(ranges)) validateNumber(settings, key, errors);
  if (![24, 30, 60].includes(settings.fps)) errors.push('fpsは24、30、60のいずれかにしてください');
  if (settings.codec !== 'h264') errors.push('codecは現在h264のみ対応しています');
  if (settings.height <= settings.width) errors.push('縦型動画のためheightはwidthより大きくしてください');
  if (!/^#[0-9a-f]{6}$/i.test(settings.hookBandColor)) {
    errors.push(`hookBandColorは6桁HEXで指定してください: ${settings.hookBandColor}`);
  }
  if (!Number.isInteger(settings.width) || !Number.isInteger(settings.height)) {
    errors.push('widthとheightは整数で指定してください');
  }
  if (!Number.isInteger(settings.transitionFrames)) {
    errors.push('transitionFramesは整数で指定してください');
  }

  return { settings, errors };
}
