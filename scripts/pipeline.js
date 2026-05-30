#!/usr/bin/env node
/**
 * pipeline.js — 日次自動実行パイプライン
 *
 * 実行: node scripts/pipeline.js
 * タスクスケジューラーから毎朝 6:30 に実行。
 *
 * コスト: 無料（Gemini 1.5 Flash 無料枠 + Buffer GraphQL 無料枠）
 *
 * ステップ:
 *   1. 記事3本生成（Gemini）→ src/content/articles/ に保存
 *   2. SNSドラフト生成（Gemini）→ sns-drafts/YYYYMMDD.md に保存
 *   3. publish.js 実行（git push + Buffer投稿）
 *   4. task-diary.md に記録
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OBSIDIAN = 'C:/Users/wtknt/Documents/iCloudDrive/iCloud~md~obsidian/Tenstrage';

// ─── .env 読み込み ────────────────────────────────────────
function loadEnv() {
  const env = {};
  for (const line of readFileSync(`${OBSIDIAN}/.env`, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)\r?$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

// ─── コンテキスト読み込み ─────────────────────────────────
function loadContext() {
  return {
    knowledge:    readFileSync(`${OBSIDIAN}/knowledge.md`, 'utf8'),
    writingRules: readFileSync(`${OBSIDIAN}/quality/writing-rules.md`, 'utf8'),
    seoRules:     readFileSync(`${OBSIDIAN}/quality/seo-rules.md`, 'utf8'),
    snsRules:     readFileSync(`${OBSIDIAN}/quality/sns-copywriting-rules.md`, 'utf8'),
    trends:       readFileSync(`${OBSIDIAN}/feedback/trends.md`, 'utf8'),
  };
}

// ─── Gemini API 呼び出し ──────────────────────────────────
async function callGemini(apiKey, systemPrompt, userPrompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
      }),
    }
  );
  const json = await res.json();
  if (json.error) throw new Error(`Gemini エラー: ${json.error.message}`);
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── スラッグ生成 ─────────────────────────────────────────
function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'article';
}

// ─── 記事3本生成 ──────────────────────────────────────────
async function generateArticles(apiKey, ctx, today) {
  console.log('\n📝 記事生成中（Gemini）...');

  const system = `あなたはタクシードライバー転職情報の専門ライターです。
以下の情報を必ず参照して記事を生成してください。

## knowledge.md（現場情報・必ず1箇所以上引用）
${ctx.knowledge}

## SEOルール
${ctx.seoRules}

## 品質ルール
${ctx.writingRules}

## 最新トレンド
${ctx.trends}`;

  const prompt = `以下の条件で記事を3本生成してください。

【条件】
- 最新トレンドから優先度の高いテーマを3つ選ぶ（既に記事化されていないもの優先）
- 各記事2,000字以上
- knowledge.mdの現場情報を1箇所以上引用
- H2見出し4〜6個、各H2にH3を2〜3個
- pubDate: ${today}

【出力形式】3本を以下の区切りで続けて出力：
---ARTICLE_START---
---
title: "タイトル"
description: "メタ説明120〜160文字"
pubDate: ${today}
tags: ["タクシー転職", "東京"]
---
本文（2,000字以上）
---ARTICLE_END---`;

  const raw = await callGemini(apiKey, system, prompt);
  const articles = [];
  const matches = [...raw.matchAll(/---ARTICLE_START---\n([\s\S]*?)---ARTICLE_END---/g)];

  for (const m of matches) {
    const content = m[1].trim();
    const titleMatch = content.match(/title:\s*"([^"]+)"/);
    const title = titleMatch?.[1] ?? `記事${articles.length + 1}`;
    const slug = toSlug(title.replace(/[^\x00-\x7F]/g, '')) || `article-${articles.length + 1}`;
    articles.push({ filename: `${today.replace(/-/g, '')}-${slug}.md`, content, title });
  }

  if (articles.length === 0) {
    console.warn('⚠️  区切り記号なし。raw出力を1ファイルに保存します。');
    articles.push({
      filename: `${today.replace(/-/g, '')}-generated.md`,
      content: raw,
      title: '生成記事',
    });
  }

  const articlesDir = join(ROOT, 'src', 'content', 'articles');
  mkdirSync(articlesDir, { recursive: true });

  const saved = [];
  for (const { filename, content, title } of articles) {
    writeFileSync(join(articlesDir, filename), content + '\n');
    console.log(`  ✅ ${filename}`);
    saved.push(title);
  }
  return saved;
}

// ─── SNSドラフト生成 ──────────────────────────────────────
async function generateSnsDraft(apiKey, ctx, today, articleTitles) {
  console.log('\n📱 SNSドラフト生成中（Gemini）...');

  const system = `あなたはSNSコピーライターです。
以下の情報を参照して投稿文を生成してください。

## knowledge.md
${ctx.knowledge}

## SNSルール
${ctx.snsRules}

## 最新トレンド
${ctx.trends}`;

  const prompt = `本日（${today}）生成した記事：
${articleTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

上記をもとにSNS投稿ドラフトを生成してください。

【X投稿3本】
- 投稿1：記事紹介（URLあり・280文字以内・ハッシュタグ3個以内）
- 投稿2：役立ちTips（URLなし・280文字以内・ハッシュタグ3個以内）
- 投稿3：質問投稿（エンゲージメント狙い・280文字以内）

【TikTok投稿1本】テロップ構成（45〜180秒）
【YouTube Shorts投稿1本】冒頭15秒キャッチ型（15〜60秒）

knowledge.mdの現場情報を1箇所以上引用。

【出力形式】以下のフォーマットで出力（publish.jsが読み取るので形式を厳守）：
# ${today} SNS投稿ドラフト

## X（Twitter）投稿

### 投稿1：記事紹介（URLあり）

**タイプ**: 記事紹介
**プラットフォーム**: X（Twitter）

本文：
\`\`\`
投稿文
\`\`\`

---

### 投稿2：役立ちTips（URLなし）

**タイプ**: ノウハウTips
**プラットフォーム**: X（Twitter）

本文：
\`\`\`
投稿文
\`\`\`

---

### 投稿3：質問投稿（エンゲージメント狙い）

**タイプ**: エンゲージメント促進
**プラットフォーム**: X（Twitter）

本文：
\`\`\`
投稿文
\`\`\`

---

## TikTok投稿（スクリプト）

### 投稿1：リアル系情報動画

**タイプ**: リアル系情報動画
**プラットフォーム**: TikTok

本文：
\`\`\`
投稿文
\`\`\`

---

## YouTube Shorts投稿（スクリプト）

### 投稿1：比較系情報動画

**タイプ**: 比較系情報動画
**プラットフォーム**: YouTube Shorts

本文：
\`\`\`
投稿文
\`\`\``;

  const draft = await callGemini(apiKey, system, prompt);
  const dateStr = today.replace(/-/g, '');
  const draftsDir = join(ROOT, 'sns-drafts');
  mkdirSync(draftsDir, { recursive: true });
  writeFileSync(join(draftsDir, `${dateStr}.md`), draft + '\n');
  console.log(`  ✅ sns-drafts/${dateStr}.md`);
  return dateStr;
}

// ─── task-diary 記録 ──────────────────────────────────────
function logDiary(entries) {
  const path = `${OBSIDIAN}/task-diary.md`;
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  writeFileSync(path, `\n### ${timestamp} pipeline.js\n${entries.join('\n')}\n` + existing);
}

// ─── メイン ───────────────────────────────────────────────
async function main() {
  console.log('🚀 pipeline.js 開始');
  const start = Date.now();

  const env = loadEnv();
  if (!env.GEMINI_TEXT_API_KEY) { console.error('❌ GEMINI_TEXT_API_KEY が未設定'); process.exit(1); }

  const ctx = loadContext();
  const today = new Date().toISOString().slice(0, 10);
  const logs = [];

  // Step 1: 記事生成
  try {
    const titles = await generateArticles(env.GEMINI_TEXT_API_KEY, ctx, today);
    titles.forEach(t => logs.push(`- 記事: ${t}`));
  } catch (e) {
    console.error('❌ 記事生成:', e.message);
    logs.push(`- 記事生成: ❌ ${e.message}`);
  }

  // Step 2: SNSドラフト生成
  const articleTitles = logs.filter(l => l.startsWith('- 記事:')).map(l => l.replace('- 記事: ', ''));
  try {
    await generateSnsDraft(env.GEMINI_TEXT_API_KEY, ctx, today, articleTitles);
    logs.push(`- SNSドラフト: sns-drafts/${today.replace(/-/g, '')}.md`);
  } catch (e) {
    console.error('❌ SNSドラフト生成:', e.message);
    logs.push(`- SNSドラフト: ❌ ${e.message}`);
  }

  // Step 3: publish.js（git push + Buffer投稿）
  console.log('\n📤 publish.js 実行中...');
  try {
    execSync('node scripts/publish.js', { cwd: ROOT, stdio: 'inherit' });
    logs.push('- publish.js: ✅');
  } catch (e) {
    console.error('❌ publish.js:', e.message);
    logs.push(`- publish.js: ❌ ${e.message}`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  logs.push(`- 実行時間: ${elapsed}秒`);
  logDiary(logs);
  console.log(`\n✅ pipeline.js 完了（${elapsed}秒）`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
