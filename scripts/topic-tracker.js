/**
 * topic-tracker.js — 投稿済みトピック管理 & 個人体験データ小出し管理
 *
 * 役割:
 *   1. getPostedTopics()    — 既存記事タイトル一覧（重複防止用）
 *   2. getNextPersonalData() — income-records.md から未使用セクションを1つ取得
 *   3. markPersonalDataUsed() — 使用済みにマーク
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { ROOT, OBSIDIAN } from './paths.js';

const USAGE_FILE  = join(ROOT, 'data', 'personal-data-usage.json');
const INCOME_FILE = join(OBSIDIAN, 'knowledge', 'income-records.md');

// ─── 投稿済み記事タイトル一覧 ─────────────────────────────────
export function getPostedTopics() {
  const articlesDir = join(ROOT, 'src', 'content', 'articles');
  if (!existsSync(articlesDir)) return [];

  const titles = [];
  for (const file of readdirSync(articlesDir)) {
    if (!file.endsWith('.md')) continue;
    const raw = readFileSync(join(articlesDir, file), 'utf8');
    const match = raw.match(/^title:\s*"?(.+?)"?\s*$/m);
    if (match?.[1]) titles.push(match[1].trim());
  }
  // 重複除去して最新50件（タイトルが長すぎるのでsliceは不要）
  return [...new Set(titles)];
}

// ─── income-records.md をセクション単位でパース ───────────────
function parseIncomeSections() {
  if (!existsSync(INCOME_FILE)) return [];

  const raw = readFileSync(INCOME_FILE, 'utf8');
  const sections = [];

  // "## カテゴリ" と "### セクション" を拾う
  const lines = raw.split('\n');
  let currentH2 = '';
  let currentH3 = '';
  let buffer = [];

  const flush = () => {
    if (currentH3 && buffer.length > 0) {
      const content = buffer.join('\n').trim();
      if (content.length > 30) {
        sections.push({
          id: `${currentH2}/${currentH3}`,
          label: `${currentH2} > ${currentH3}`,
          content,
        });
      }
    }
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentH2 = line.replace(/^## /, '').trim();
      currentH3 = '';
    } else if (line.startsWith('### ')) {
      flush();
      currentH3 = line.replace(/^### /, '').trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

// ─── 使用履歴ファイルの読み書き ──────────────────────────────
function loadUsage() {
  if (!existsSync(USAGE_FILE)) {
    return { used: [], queue: [] };
  }
  return JSON.parse(readFileSync(USAGE_FILE, 'utf8'));
}

function saveUsage(usage) {
  writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

// ─── キューを初期化（未登録セクションを追加） ────────────────
function syncQueue(usage) {
  const sections = parseIncomeSections();
  const allIds = sections.map(s => s.id);

  // queueにないIDを末尾に追加（used含め全IDを管理）
  const known = new Set([...usage.used, ...usage.queue]);
  for (const id of allIds) {
    if (!known.has(id)) usage.queue.push(id);
  }
  return sections;
}

// ─── 次の未使用個人データを取得 ──────────────────────────────
export function getNextPersonalData() {
  const usage = loadUsage();
  const sections = syncQueue(usage);

  if (usage.queue.length === 0) {
    // 全部使い切ったらリセット
    console.log('  ♻️  個人データをリセット（全セクション再利用）');
    usage.queue = sections.map(s => s.id);
    usage.used = [];
  }

  const nextId = usage.queue[0];
  const section = sections.find(s => s.id === nextId);

  if (!section) {
    saveUsage(usage);
    return null;
  }

  saveUsage(usage); // キュー状態を保存（まだ使用済みにしない）
  return section; // { id, label, content }
}

// ─── 使用済みにマーク ─────────────────────────────────────────
export function markPersonalDataUsed(id) {
  const usage = loadUsage();
  usage.queue  = usage.queue.filter(q => q !== id);
  if (!usage.used.includes(id)) usage.used.push(id);
  saveUsage(usage);
  console.log(`  ✅ 個人データ使用済み: ${id}`);
}

// ─── 現在のキュー状況を表示（デバッグ用） ───────────────────
export function showStatus() {
  const usage = loadUsage();
  const sections = syncQueue(usage);
  console.log(`個人データ: 残り${usage.queue.length}件 / 使用済み${usage.used.length}件`);
  console.log('次のセクション:', usage.queue[0] ?? 'なし');
}
