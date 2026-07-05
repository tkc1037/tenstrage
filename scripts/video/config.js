import { join } from 'path';
import { ROOT } from '../paths.js';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const COMPOSITION_ID = 'TaxiVideo';
export const BG_STYLES = ['bokeh', 'aurora', 'waves', 'grid', 'geometric', 'gradient'];
export const BGM_TRACKS = {
  main: 'bgm-main.mp3',
  'sales-era': 'bgm-sales-era.mp3',
  company: 'bgm-company.mp3',
};

export const VIDEO_SCRIPTS_DIR = join(ROOT, 'video-scripts');
export const AUDIO_DIR = join(ROOT, 'public', 'audio');
export const VIDEO_DIR = join(ROOT, 'public', 'video');
export const IMAGE_DIR = join(ROOT, 'public', 'images');
export const QA_DIR = join(ROOT, '.video-qa');
export const REMOTION_ENTRY = join(ROOT, 'src', 'video', 'Root.tsx');
