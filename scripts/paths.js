/**
 * paths.js — プロジェクト共通パス解決
 *
 * 全スクリプトでこれを使う:
 *   import { ROOT, OBSIDIAN, loadEnv } from './paths.js';
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** tenstrage/ プロジェクトルート */
export const ROOT = join(__dirname, '..');

/** Obsidian vault パス（環境変数で上書き可能） */
export const OBSIDIAN = process.env.OBSIDIAN_PATH
  || 'C:/Users/wtknt/Documents/iCloudDrive/iCloud~md~obsidian/Tenstrage';

/**
 * .env 読み込み（tenstrage/.env 優先 → Obsidian フォールバック）
 */
export function loadEnv() {
  const candidates = [
    join(ROOT, '.env'),
    `${OBSIDIAN}/.env`,
    `${OBSIDIAN}/.env 2`,
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      const env = {};
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)\r?$/);
        if (m) env[m[1].trim()] = m[2].trim();
      }
      return env;
    }
  }
  throw new Error('.env が見つかりません');
}
