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

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)\r?$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const projectEnvPath = join(ROOT, '.env');
const projectEnv = readEnvFile(projectEnvPath);

/** Obsidian vault パス（OS環境変数 → tenstrage/.env） */
export const OBSIDIAN = process.env.OBSIDIAN_PATH || projectEnv.OBSIDIAN_PATH;

if (!OBSIDIAN) {
  throw new Error('OBSIDIAN_PATH がOS環境変数または tenstrage/.env に未設定です');
}

/**
 * .env 読み込み（tenstrage/.env に一本化）
 */
export function loadEnv() {
  const candidates = [
    join(ROOT, '.env'),
  ];
  const existing = candidates.filter(existsSync);
  if (existing.length === 0) throw new Error('.env が見つかりません');

  return Object.assign({}, ...existing.map(readEnvFile));
}
