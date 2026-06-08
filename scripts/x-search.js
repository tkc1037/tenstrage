#!/usr/bin/env node
/**
 * x-search.js — X APIでタクシー転職系の生の声を収集
 *
 * 実行: node scripts/x-search.js
 * 出力: Obsidian vault の raw/x-search/YYYYMMDD.md
 *
 * 注意:
 * - X APIの読み取り課金が発生します。
 * - 実行前にユーザー承認を取ること。
 */

import { writeFileSync, mkdirSync } from 'fs';
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

const DEFAULT_MAX_RESULTS = 10;
const SEARCH_ENDPOINT = 'https://api.twitter.com/2/tweets/search/recent';

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
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
  // X recent search は通常10〜100件。コスト暴発を避けるため上限100。
  if (!Number.isFinite(n)) return DEFAULT_MAX_RESULTS;
  return Math.min(Math.max(Math.floor(n), 10), 100);
}

function buildQuery(keyword) {
  // 日本語投稿中心。リポストは除外し、直近7日内のrecent searchに任せる。
  return `${keyword} lang:ja -is:retweet`;
}

function formatMetric(tweet) {
  const m = tweet.public_metrics ?? {};
  return `likes=${m.like_count ?? 0}, reposts=${m.retweet_count ?? 0}, replies=${m.reply_count ?? 0}, quotes=${m.quote_count ?? 0}`;
}

function tweetUrl(tweet) {
  return `https://x.com/i/web/status/${tweet.id}`;
}

async function searchKeyword({ bearerToken, keyword, maxResults }) {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('query', buildQuery(keyword));
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

  const keywords = parseKeywords(env);
  const maxResults = parseMaxResults(env);
  const date = todayStamp();
  const outDir = join(OBSIDIAN, 'raw', 'x-search');
  const outFile = join(outDir, `${date}.md`);

  console.log(`🔎 X検索: ${keywords.length} keywords × max ${maxResults}`);

  const resultsByKeyword = {};
  for (const keyword of keywords) {
    console.log(`  - ${keyword}`);
    resultsByKeyword[keyword] = await searchKeyword({ bearerToken, keyword, maxResults });
    // 軽いレート制限対策
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, renderMarkdown({ date, keywords, maxResults, resultsByKeyword }), 'utf8');

  console.log(`✅ 保存: ${outFile}`);
}

main().catch((err) => {
  console.error('❌ x-search.js エラー:', err.message);
  process.exit(1);
});
