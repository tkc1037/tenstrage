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
import { join } from 'path';
import { execSync } from 'child_process';
import { NlmSession } from './notebooklm-client.js';
import { ROOT, OBSIDIAN, loadEnv } from './paths.js';

// ─── コンテキスト読み込み ─────────────────────────────────
// NLM_KNOWLEDGE_ID が設定済みなら NotebookLM クエリ（~1,500 tokens）
// 未設定ならファイル直読み（フォールバック）
async function loadContext(env) {
  const knowledgeId = env.NLM_KNOWLEDGE_ID;
  const researchId  = env.NLM_RESEARCH_ID;

  if (knowledgeId && researchId) {
    console.log('📚 NotebookLM からコンテキスト取得中...');
    const nlm = new NlmSession();
    try {
      await nlm.connect();

      // Knowledge ノートブックからルールを取得
      await nlm.openNotebook(knowledgeId);
      const rules = await nlm.chat(
        '記事生成に必要な情報を簡潔にまとめてください：' +
        '①SEOルール（キーワード・タイトル形式）' +
        '②品質基準（文字数・構成・アフィリエイトルール）' +
        '③SNSルール（X/TikTok/YouTube各投稿の要件）' +
        '④knowledge.mdの現場情報から特に引用すべき具体的データ。' +
        '合計500字以内で箇条書き。'
      );

      // Research ノートブックからトレンドを取得
      await nlm.openNotebook(researchId);
      const trends = await nlm.chat(
        '今日の記事テーマとして優先度の高いトレンド・ネタを3つ挙げてください。' +
        '各テーマに「理由（検索需要・競合状況）」と「推奨キーワード」を含めて。' +
        '箇条書き300字以内。'
      );

      console.log('  ✅ NotebookLM クエリ完了');
      return { fromNotebookLM: true, rules, trends };
    } catch (e) {
      console.warn(`  ⚠️  NotebookLM 失敗、ファイル読み込みにフォールバック: ${e.message}`);
    } finally {
      nlm.close();
    }
  }

  // フォールバック: knowledge/ フォルダから直読み
  const knowledgeDir = `${OBSIDIAN}/knowledge`;
  const readIfExists = (p) => existsSync(p) ? readFileSync(p, 'utf8') : '';
  // iCloud が "file 2.md" にリネームする問題のフォールバック
  const readWithFallback = (base) => readIfExists(base) || readIfExists(base.replace('.md', ' 2.md'));
  return {
    fromNotebookLM: false,
    knowledge:    [
      readIfExists(`${knowledgeDir}/industry.md`),
      readIfExists(`${knowledgeDir}/income-records.md`),
    ].filter(Boolean).join('\n\n---\n\n'),
    writingRules: readWithFallback(`${OBSIDIAN}/quality/writing-rules.md`),
    seoRules:     readWithFallback(`${OBSIDIAN}/quality/seo-rules.md`),
    snsRules:     readWithFallback(`${OBSIDIAN}/quality/sns-rules.md`),
    trends:       readIfExists(`${knowledgeDir}/trends.md`) || readIfExists(`${OBSIDIAN}/feedback/trends.md`),
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

  // NotebookLM コンテキスト or ファイル直読み
  const system = ctx.fromNotebookLM
    ? `あなたはタクシードライバー転職情報の専門ライターです。
以下はNotebookLMが要約したプロジェクトルールと現場情報です。必ず従ってください。

## ルール・品質基準（SEO・品質・SNS・現場情報）
${ctx.rules}

## 今日の推奨テーマ
${ctx.trends}`
    : `あなたはタクシードライバー転職情報の専門ライターです。
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

  const system = ctx.fromNotebookLM
    ? `あなたはSNSコピーライターです。
以下はNotebookLMが要約したルールと現場情報です。必ず従ってください。

## SNS・現場情報・ルール（NotebookLM要約）
${ctx.rules}

## 今日のトレンド
${ctx.trends}`
    : `あなたはSNSコピーライターです。
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

【X投稿3本 ※最重要：各投稿は絶対に140文字以内（日本語は1文字=2文字換算なので実質140文字）。超過はAPIエラーになる】
- 投稿1：記事紹介（URLあり・140文字以内・ハッシュタグ2個以内）
- 投稿2：役立ちTips（URLなし・140文字以内・ハッシュタグ2個以内）
- 投稿3：質問投稿（エンゲージメント狙い・140文字以内）
※絵文字は最小限（1-2個）。冗長な説明は省き、インパクト重視で短く。

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

  const ctx = await loadContext(env);
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
