#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { OBSIDIAN } from './paths.js';

const REGISTRY_PATH = join(OBSIDIAN, 'rules/x-post-registry.md');
const HOOK_TYPES = new Set(['まとめ', '賛否・逆説', '体験談', '質問', 'Tips']);
const WARNING_HOOK_JACCARD = 0.45;
const WARNING_KEYWORD_OVERLAP = 0.60;
const STRONG_HOOK_JACCARD = 0.65;
const STRONG_KEYWORD_OVERLAP = 0.70;

const TOPIC_PATTERNS = [
  { pattern: /GOアプリ|配車アプリ|S\.RIDE|Uber|DiDi|連続配車|サンキューチケット/gi, canonical: '配車アプリ' },
  { pattern: /JPN\s*TAXI|JAPAN\s*TAXI|ジャパンタクシー|車両|車両選び/gi, canonical: '車両選び' },
  { pattern: /会社選び|会社の条件|転職時の確認|面接|求人/gi, canonical: '会社選び' },
  { pattern: /事故負担|負担金|事故リスク|やめとけ/gi, canonical: '事故負担' },
  { pattern: /プロフィール|元IT営業|年収|収入|814万|454万/gi, canonical: 'プロフィール収入' },
  { pattern: /祝い金|支度金|返金条件/gi, canonical: '祝い金' },
  { pattern: /二種免許|2種免許|免許/gi, canonical: '二種免許' },
  { pattern: /歩合|歩合率|歩合制/gi, canonical: '歩合' },
  { pattern: /隔日勤務|昼日勤|夜日勤|勤務/gi, canonical: '勤務形態' },
  { pattern: /ロング|遠距離|空港|羽田|成田/gi, canonical: 'ロング営業' },
];

function parseArgs(argv) {
  const result = { theme: '', hookType: '', hookLine: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--theme') result.theme = argv[++i] ?? '';
    else if (arg === '--hook' || arg === '--hook-type') result.hookType = argv[++i] ?? '';
    else if (arg === '--hook-line') result.hookLine = argv[++i] ?? '';
    else if (!result.theme) result.theme = arg;
    else if (!result.hookType) result.hookType = arg;
    else result.hookLine = [result.hookLine, arg].filter(Boolean).join(' ');
  }
  return result;
}

function parseTableLine(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim().replace(/^`|`$/g, ''));
}

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) throw new Error(`X投稿台帳が見つかりません: ${REGISTRY_PATH}`);
  const rows = [];
  for (const line of readFileSync(REGISTRY_PATH, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('| `x-')) continue;
    const cells = parseTableLine(line);
    rows.push({
      postId: cells[0],
      status: cells[1],
      publishedAt: cells[2],
      theme: cells[3],
      hookType: cells[4],
      articleIntro: cells[5],
      hookLine: cells[6],
      conclusion: cells[7],
      readerProblem: cells[8],
      source: cells[9],
      bufferPostId: cells[10],
      relation: cells[11],
    });
  }
  return rows.filter((row) => row.status !== 'deleted');
}

function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`*_#>[\]()]/g, ' ')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function shingles(text, size = 3, limit = 180) {
  const normalized = normalizeText(text).slice(0, limit);
  const set = new Set();
  for (let i = 0; i <= normalized.length - size; i++) set.add(normalized.slice(i, i + size));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function extractKeywords(text) {
  const keywords = new Set();
  for (const { pattern, canonical } of TOPIC_PATTERNS) {
    if (pattern.test(text)) keywords.add(canonical);
    pattern.lastIndex = 0;
  }
  return keywords;
}

function overlapScore(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const x of a) for (const y of b) if (x === y || x.includes(y) || y.includes(x)) overlap++;
  return overlap / Math.min(a.size, b.size);
}

function findThreeHookRun(proposedHookType, rows) {
  const recent = rows.slice(0, 7).map((row) => row.hookType);
  const hooks = [proposedHookType, ...recent];
  for (let i = 0; i <= hooks.length - 3; i++) {
    if (hooks[i] && hooks[i] === hooks[i + 1] && hooks[i] === hooks[i + 2]) return hooks[i];
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));
const rows = loadRegistry();

if (!args.theme && !args.hookType && !args.hookLine) {
  console.log(`\n📋 X投稿台帳（${rows.length}件）\n`);
  console.log('postId | status | theme | hookType | articleIntro');
  console.log('-------|--------|-------|----------|-------------');
  for (const row of rows) {
    console.log(`${row.postId} | ${row.status} | ${row.theme} | ${row.hookType} | ${row.articleIntro}`);
  }
  console.log('\n重複チェック: node scripts/check-x-duplicate.js --theme "テーマ" --hook "フック型" --hook-line "フック1行"');
  process.exit(0);
}

if (!args.theme || !args.hookType) {
  console.error('使い方: node scripts/check-x-duplicate.js --theme "テーマ" --hook "まとめ|賛否・逆説|体験談|質問|Tips" [--hook-line "フック1行"]');
  process.exit(1);
}

if (!HOOK_TYPES.has(args.hookType)) {
  console.error(`フック型は5種から選んでください: ${[...HOOK_TYPES].join(' / ')}`);
  process.exit(1);
}

console.log(`\n🔍 X重複チェック: ${args.theme} / ${args.hookType}\n`);

const exactDuplicates = rows.filter((row) => row.theme === args.theme && row.hookType === args.hookType);
if (exactDuplicates.length) {
  console.log('❌ 同テーマ×同フック型の既存投稿があります:\n');
  for (const row of exactDuplicates) {
    console.log(`  ${row.postId} [${row.status}] ${row.theme} / ${row.hookType}`);
    console.log(`    フック: ${row.hookLine}`);
  }
  console.log('\n→ 生成禁止。別テーマ・別フック型・別角度を選んでください。');
  process.exit(1);
}

const warnings = [];
const hookRun = findThreeHookRun(args.hookType, rows);
if (hookRun) {
  warnings.push(`直近7投稿内で ${hookRun} が3連続になります`);
}

const proposedText = `${args.theme} ${args.hookLine}`;
const proposedShingles = shingles(args.hookLine || args.theme);
const proposedKeywords = extractKeywords(proposedText);
for (const row of rows) {
  const hookScore = jaccard(proposedShingles, shingles(row.hookLine));
  const keywordScore = overlapScore(proposedKeywords, extractKeywords(`${row.theme} ${row.hookLine} ${row.conclusion}`));
  if (hookScore >= STRONG_HOOK_JACCARD && keywordScore >= STRONG_KEYWORD_OVERLAP) {
    warnings.push(`強い類似: ${row.postId} hookJaccard=${hookScore.toFixed(2)} keywordOverlap=${keywordScore.toFixed(2)}`);
  } else if (hookScore >= WARNING_HOOK_JACCARD || keywordScore >= WARNING_KEYWORD_OVERLAP) {
    warnings.push(`類似注意: ${row.postId} hookJaccard=${hookScore.toFixed(2)} keywordOverlap=${keywordScore.toFixed(2)}`);
  }
}

if (warnings.length) {
  console.log('⚠️  警告:\n');
  for (const warning of warnings) console.log(`  - ${warning}`);
  console.log('\n✅ 同テーマ×同フック型は未検出。ただし差別化メモを残してください。');
} else {
  console.log('✅ 重複なし — X投稿案として検討できます。');
}
process.exit(0);
