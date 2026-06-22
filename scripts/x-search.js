#!/usr/bin/env node
/**
 * x-search.js — X APIでタクシー転職系の生の声を収集
 *
 * 実行: node scripts/x-search.js
 * 確認: node scripts/x-search.js --check（API呼び出しなし）
 * 出力: Obsidian vault の raw/x-search/YYYYMMDD.md
 *
 * 注意:
 * - X APIの読み取り課金が発生します。
 * - 実行前にユーザー承認を取ること。
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { OBSIDIAN, loadEnv } from './paths.js';

const DEFAULT_KEYWORDS = [
  'タクシードライバー 転職',
  'タクシー 年収',
  'タクシー 入社祝い金',
  'タクシー 求人 東京',
  'GO タクシー ドライバー',
  'タクシー 夜勤 きつい',
  'タクシー 歩合',
];

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_INTERVAL_DAYS = 14;
const DEFAULT_MIN_FAVES = 30;
const DEFAULT_INVENTORY_THRESHOLD = 3;
const DEFAULT_KEYWORDS_PER_RUN = 3;
const SEARCH_ENDPOINT = 'https://api.twitter.com/2/tweets/search/recent';

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function parseDateStamp(stamp) {
  const match = stamp.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
}

function findLatestSearchDate(outDir) {
  if (!existsSync(outDir)) return null;
  const stamps = readdirSync(outDir)
    .map((file) => file.match(/^(\d{8})\.md$/)?.[1])
    .filter(Boolean)
    .sort();
  return stamps.length > 0 ? stamps.at(-1) : null;
}

function shouldSkipSearch(outDir, intervalDays, force) {
  if (force) return null;
  const latestStamp = findLatestSearchDate(outDir);
  if (!latestStamp) return null;

  const latestDate = parseDateStamp(latestStamp);
  const elapsedMs = Date.now() - latestDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);
  if (elapsedDays >= intervalDays) return null;

  return {
    latestStamp,
    elapsedDays,
    remainingDays: intervalDays - elapsedDays,
  };
}

function parseKeywords(env) {
  const raw = env.X_SEARCH_KEYWORDS;
  if (!raw) return DEFAULT_KEYWORDS;
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMaxResults(env) {
  const n = Number(env.X_SEARCH_MAX_RESULTS ?? DEFAULT_MAX_RESULTS);
  // Xは引用確定取得に温存するため、当たり付けは少数だけ取得する。
  if (!Number.isFinite(n)) return DEFAULT_MAX_RESULTS;
  return Math.min(Math.max(Math.floor(n), 3), 5);
}

function parsePositiveInt(value, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(Math.floor(n), 1);
}

function parseKeywordsPerRun(env, keywordCount) {
  const n = parsePositiveInt(env.X_SEARCH_KEYWORDS_PER_RUN, DEFAULT_KEYWORDS_PER_RUN);
  return Math.min(Math.max(n, 2), Math.min(3, keywordCount));
}

function articleIdeasPath() {
  return join(OBSIDIAN, 'reports', 'article-ideas.md');
}

function countOpenTier12Ideas() {
  const path = articleIdeasPath();
  if (!existsSync(path)) return 0;
  const content = readFileSync(path, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|'))
    .filter((line) => !line.includes('---'))
    .filter((line) => /\|\s*Tier[12]\s*\|/.test(line))
    .filter((line) => /\|\s*未着手\s*\|?\s*$/.test(line))
    .length;
}

function inventorySkipStatus(threshold) {
  const openTier12 = countOpenTier12Ideas();
  return { openTier12, shouldSkip: openTier12 >= threshold };
}

function yieldLedgerPath(outDir) {
  return join(outDir, 'keyword-yield.md');
}

function readKeywordYield(outDir) {
  const path = yieldLedgerPath(outDir);
  if (!existsSync(path)) return new Map();
  const rows = new Map();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('| `')) continue;
    const cols = line.split('|').map((col) => col.trim());
    const keyword = cols[1]?.replace(/^`|`$/g, '');
    if (!keyword) continue;
    rows.set(keyword, {
      runs: Number(cols[2]) || 0,
      fetched: Number(cols[3]) || 0,
      used: Number(cols[4]) || 0,
      lastRun: cols[6] || '',
    });
  }
  return rows;
}

function selectRotatingKeywords(keywords, outDir, perRun) {
  const stats = readKeywordYield(outDir);
  return [...keywords]
    .sort((a, b) => {
      const aStats = stats.get(a) ?? { runs: 0, used: 0, fetched: 0, lastRun: '' };
      const bStats = stats.get(b) ?? { runs: 0, used: 0, fetched: 0, lastRun: '' };
      const aRate = aStats.fetched > 0 ? aStats.used / aStats.fetched : 0;
      const bRate = bStats.fetched > 0 ? bStats.used / bStats.fetched : 0;
      return (
        aStats.runs - bStats.runs ||
        aStats.lastRun.localeCompare(bStats.lastRun) ||
        aRate - bRate ||
        a.localeCompare(b, 'ja')
      );
    })
    .slice(0, perRun);
}

function writeKeywordYield({ outDir, keywords, resultsByKeyword, date }) {
  const stats = readKeywordYield(outDir);
  for (const keyword of keywords) {
    const current = stats.get(keyword) ?? { runs: 0, fetched: 0, used: 0, lastRun: '' };
    current.runs += 1;
    current.fetched += resultsByKeyword[keyword]?.length ?? 0;
    current.lastRun = date;
    stats.set(keyword, current);
  }

  const lines = [
    '# X検索キーワード歩留まり',
    '',
    'X検索で取得したキーワード別の軽量台帳。`used` はIngest後に手動更新し、採用率を見る。',
    '',
    '| キーワード | runs | fetched | used | adoptionRate | lastRun |',
    '|---|---:|---:|---:|---:|---|',
  ];

  for (const [keyword, row] of [...stats.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'))) {
    const rate = row.fetched > 0 ? row.used / row.fetched : 0;
    lines.push(`| \`${keyword}\` | ${row.runs} | ${row.fetched} | ${row.used} | ${rate.toFixed(2)} | ${row.lastRun} |`);
  }

  writeFileSync(yieldLedgerPath(outDir), `${lines.join('\n')}\n`, 'utf8');
}

function buildQuery(keyword, minFaves) {
  return `${keyword} min_faves:${minFaves} -is:retweet lang:ja`;
}

function formatMetric(tweet) {
  const m = tweet.public_metrics ?? {};
  return `likes=${m.like_count ?? 0}, reposts=${m.retweet_count ?? 0}, replies=${m.reply_count ?? 0}, quotes=${m.quote_count ?? 0}`;
}

function tweetUrl(tweet) {
  return `https://x.com/i/web/status/${tweet.id}`;
}

async function searchKeyword({ bearerToken, keyword, maxResults, minFaves }) {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('query', buildQuery(keyword, minFaves));
  url.searchParams.set('max_results', String(maxResults));
  url.searchParams.set('sort_order', 'recency');
  url.searchParams.set('tweet.fields', 'created_at,public_metrics,lang,author_id');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X API error for "${keyword}": ${res.status} ${err.slice(0, 500)}`);
  }

  const json = await res.json();
  return json.data ?? [];
}

function renderMarkdown({ date, keywords, maxResults, resultsByKeyword }) {
  const lines = [];
  lines.push(`# X検索ログ — ${date}`);
  lines.push('');
  lines.push('> X API recent searchで収集したタクシー転職系の生の声。');
  lines.push('> Ingest時は、個人攻撃・晒しにならないよう要約し、投稿URLを根拠として扱う。');
  lines.push('');
  lines.push('## 実行条件');
  lines.push('');
  lines.push(`- キーワード数: ${keywords.length}`);
  lines.push(`- 最大取得件数/キーワード: ${maxResults}`);
  lines.push(`- 推定読み取り件数: 最大 ${keywords.length * maxResults} 件`);
  lines.push('');

  for (const keyword of keywords) {
    const tweets = resultsByKeyword[keyword] ?? [];
    lines.push(`## ${keyword}`);
    lines.push('');
    if (tweets.length === 0) {
      lines.push('（取得なし）');
      lines.push('');
      continue;
    }

    tweets.forEach((tweet, index) => {
      const text = (tweet.text ?? '').replace(/\r?\n/g, ' ').trim();
      lines.push(`### ${index + 1}. ${tweet.created_at ?? ''}`);
      lines.push('');
      lines.push(`- URL: ${tweetUrl(tweet)}`);
      lines.push(`- 指標: ${formatMetric(tweet)}`);
      lines.push(`- author_id: ${tweet.author_id ?? ''}`);
      lines.push('');
      lines.push('```text');
      lines.push(text);
      lines.push('```');
      lines.push('');
    });
  }

  lines.push('## Ingestメモ');
  lines.push('');
  lines.push('- 生の声から、読者の不安・期待・誤解を抽出する');
  lines.push('- 数値や制度に関する主張は必ず一次情報または公式情報で検証する');
  lines.push('- 個人の投稿本文を長く引用しすぎず、要約とURL参照を基本にする');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const env = loadEnv();
  const bearerToken = env.X_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('X_BEARER_TOKEN が .env に未設定です');
  }

  const allKeywords = parseKeywords(env);
  const maxResults = parseMaxResults(env);
  const minFaves = parsePositiveInt(env.X_SEARCH_MIN_FAVES, DEFAULT_MIN_FAVES);
  const inventoryThreshold = parsePositiveInt(
    env.X_SEARCH_IDEA_THRESHOLD,
    DEFAULT_INVENTORY_THRESHOLD,
  );
  const intervalDays = Math.max(
    Number(env.X_SEARCH_INTERVAL_DAYS ?? DEFAULT_INTERVAL_DAYS) || DEFAULT_INTERVAL_DAYS,
    1,
  );
  const force = process.argv.includes('--force');
  const checkOnly = process.argv.includes('--check');
  const date = todayStamp();
  const outDir = join(OBSIDIAN, 'raw', 'x-search');
  const outFile = join(outDir, `${date}.md`);
  const keywordsPerRun = parseKeywordsPerRun(env, allKeywords.length);
  const keywords = selectRotatingKeywords(allKeywords, outDir, keywordsPerRun);
  const inventory = inventorySkipStatus(inventoryThreshold);

  const skip = shouldSkipSearch(outDir, intervalDays, force);
  if (checkOnly) {
    console.log('✅ X検索設定チェック');
    console.log(`  Bearer token: ${bearerToken ? '設定済み' : '未設定'}`);
    console.log(`  キーワード: ${keywords.length}/${allKeywords.length}件`);
    console.log(`  取得上限: ${maxResults}件/キーワード`);
    console.log(`  min_faves: ${minFaves}`);
    console.log(`  Tier1/2未着手在庫: ${inventory.openTier12}件（閾値${inventoryThreshold}件）`);
    console.log(`  収集間隔: ${intervalDays}日`);
    console.log(`  出力先: ${outDir}`);
    console.log(inventory.shouldSkip
      ? '  実行判定: スキップ（Tier1/2未着手在庫が十分）'
      : skip
      ? `  実行判定: スキップ（次回まで約${skip.remainingDays}日）`
      : '  実行判定: 実行可能（API呼び出しはしていません）');
    return;
  }

  if (inventory.shouldSkip) {
    console.log(
      `⏭️ X検索をスキップ: Tier1/2未着手在庫=${inventory.openTier12}件, ` +
      `閾値=${inventoryThreshold}件`,
    );
    console.log('   有料Xは引用確定取得に温存し、当たり付けは求人/競合の無料リサーチを優先してください。');
    return;
  }

  if (skip) {
    console.log(
      `⏭️ X検索をスキップ: 前回=${skip.latestStamp}, 経過=${skip.elapsedDays}日, ` +
      `次回まで約${skip.remainingDays}日`,
    );
    console.log('   緊急時のみ --force を指定してください。');
    return;
  }

  console.log(`🔎 X検索: ${keywords.length}/${allKeywords.length} keywords × max ${maxResults} / min_faves:${minFaves}`);

  const resultsByKeyword = {};
  for (const keyword of keywords) {
    console.log(`  - ${keyword}`);
    resultsByKeyword[keyword] = await searchKeyword({ bearerToken, keyword, maxResults, minFaves });
    // 軽いレート制限対策
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, renderMarkdown({ date, keywords, maxResults, resultsByKeyword }), 'utf8');
  writeKeywordYield({ outDir, keywords, resultsByKeyword, date });

  console.log(`✅ 保存: ${outFile}`);
}

main().catch((err) => {
  console.error('❌ x-search.js エラー:', err.message);
  process.exit(1);
});
