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

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { NlmSession } from './notebooklm-client.js';
import { ROOT, OBSIDIAN, loadEnv } from './paths.js';
import { getPostedTopics, getNextPersonalData, markPersonalDataUsed } from './topic-tracker.js';

// ─── コンテキスト読み込み ─────────────────────────────────
// 個人データ（income-records.md, knowledge.md）→ 直接・小出し
// 一般ナレッジ（業界情報・トレンド等）→ NotebookLM要約（トークン節約）
async function loadContext(env) {
  const knowledgeId = env.NLM_KNOWLEDGE_ID;
  const researchId  = env.NLM_RESEARCH_ID;

  const readIfExists = (p) => existsSync(p) ? readFileSync(p, 'utf8') : '';
  const readWithFallback = (base) => readIfExists(base) || readIfExists(base.replace('.md', ' 2.md'));

  // 今日の体験談（income-records.md + knowledge.md から小出し）
  console.log('📖 個人体験データ取得中...');
  const personalData = getNextPersonalData();
  if (personalData) {
    console.log(`  → 今日の体験談: ${personalData.label}`);
  }

  // 投稿済みトピック（重複防止）
  const postedTopics = getPostedTopics();
  console.log(`  → 投稿済み記事: ${postedTopics.length}件`);

  // 一般ナレッジ + トレンド: NotebookLM要約 → フォールバック: ファイル直読み
  let nlmContext = '';
  let trends = '';
  if (knowledgeId && researchId) {
    console.log('📚 NotebookLM → 一般ナレッジ要約 + トレンド...');
    const nlm = new NlmSession();
    try {
      await nlm.connect();

      await nlm.openNotebook(knowledgeId);
      nlmContext = await nlm.chat(
        '記事生成に必要な情報を簡潔にまとめてください：' +
        '①業界動向（給与相場・勤務形態・需要）' +
        '②SEOルール（キーワード・タイトル形式）' +
        '③品質基準（文字数・構成・アフィリエイトルール）' +
        '④SNSルール（X/TikTok/YouTube各投稿の要件）。' +
        '合計500字以内で箇条書き。個人の給与明細・現場体験の具体的数値は含めないこと（別途直接引用するため）。'
      );

      await nlm.openNotebook(researchId);
      trends = await nlm.chat(
        '今日の記事テーマとして優先度の高いトレンド・ネタを3つ挙げてください。' +
        '各テーマに「理由（検索需要・競合状況）」と「推奨キーワード」を含めて。' +
        '箇条書き300字以内。'
      );

      console.log('  ✅ NotebookLM クエリ完了');
    } catch (e) {
      console.warn(`  ⚠️  NotebookLM 失敗、ファイルにフォールバック: ${e.message}`);
    } finally {
      nlm.close();
    }
  }

  // フォールバック
  if (!nlmContext) {
    const knowledgeDir = `${OBSIDIAN}/knowledge`;
    nlmContext = [
      readIfExists(`${knowledgeDir}/industry.md`),
      readWithFallback(`${OBSIDIAN}/quality/writing-rules.md`).slice(0, 1000),
      readWithFallback(`${OBSIDIAN}/quality/seo-rules.md`).slice(0, 1000),
      readWithFallback(`${OBSIDIAN}/quality/sns-rules.md`).slice(0, 1000),
    ].filter(Boolean).join('\n\n');
  }
  if (!trends) {
    const knowledgeDir = `${OBSIDIAN}/knowledge`;
    trends = readIfExists(`${knowledgeDir}/trends.md`) || readIfExists(`${OBSIDIAN}/feedback/trends.md`);
  }

  return { nlmContext, trends, personalData, postedTopics };
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

  // 個人体験データと投稿済みトピックは共通で構築
  const personalBlock = ctx.personalData
    ? `## 【今日の体験談・実データ】（必ず1箇所以上、具体的数値そのままで引用すること）
ラベル: ${ctx.personalData.label}
---
${ctx.personalData.content}
---`
    : '';

  const avoidBlock = ctx.postedTopics?.length
    ? `## 【投稿済みテーマ一覧】（これらと被るテーマ・角度での記事は絶対に生成しないこと）
${ctx.postedTopics.slice(-50).map(t => `- ${t}`).join('\n')}`
    : '';

  const system = `あなたはタクシードライバー転職情報の専門ライターです。

## 業界情報・ルール（NotebookLM要約）
${ctx.nlmContext}

${personalBlock}

${avoidBlock}

## 最新トレンド
${ctx.trends}`;

  const prompt = `以下の条件で記事を3本生成してください。

【条件】
- 「投稿済みテーマ一覧」と被らない新しい角度・テーマを選ぶ（必須）
- 「今日の体験談・実データ」を各記事に1箇所以上、数値をそのまま引用（加工・丸めない）
- 各記事2,000字以上
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

  const personalBlock = ctx.personalData
    ? `## 【今日の体験談・実データ】（X投稿1本以上に具体的数値そのままで織り込むこと）
ラベル: ${ctx.personalData.label}
---
${ctx.personalData.content}
---`
    : '';

  const system = `あなたはSNSコピーライターです。

## ルール・業界情報（NotebookLM要約）
${ctx.nlmContext}

${personalBlock}

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
  let articleGenerated = false;
  try {
    const titles = await generateArticles(env.GEMINI_TEXT_API_KEY, ctx, today);
    titles.forEach(t => logs.push(`- 記事: ${t}`));
    articleGenerated = titles.length > 0;
  } catch (e) {
    console.error('❌ 記事生成:', e.message);
    logs.push(`- 記事生成: ❌ ${e.message}`);
  }

  // 記事生成成功時のみ個人データを使用済みマーク
  if (articleGenerated && ctx.personalData) {
    markPersonalDataUsed(ctx.personalData.id);
    logs.push(`- 体験談使用: ${ctx.personalData.label}`);
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

  // Step 3: 検証ステップ（データの正確性・最新性を確認）
  if (articleGenerated) {
    console.log('\n🔍 検証ステップ: 記事内容の正確性チェック中...');
    try {
      const dateStr = today.replace(/-/g, '');
      const articlesDir = join(ROOT, 'src', 'content', 'articles');
      const todayArticles = readdirSync(articlesDir)
        .filter(f => f.startsWith(dateStr) && f.endsWith('.md'));

      const articlesToCheck = todayArticles
        .map(f => readFileSync(join(articlesDir, f), 'utf8'))
        .join('\n---\n');

      const sourceData = ctx.personalData?.content ?? '';

      const verifyPrompt = `以下の記事群にファクトチェックを行ってください。

【チェック項目】
1. 引用されている数値（年収・月収・歩合率等）が「引用元データ」と一致しているか
2. 「令和X年」「202X年」等の年号・西暦が現在（${today}）時点で正しいか
3. 制度名・サービス名（GOアプリ等）が最新の名称か
4. 記事間で矛盾する記述がないか

【引用元データ】
${sourceData}

【検証対象の記事】
${articlesToCheck.slice(0, 6000)}

【出力形式】
問題なし → "PASS"
問題あり → "FAIL: [ファイル名] [問題の説明]" を箇条書き`;

      const result = await callGemini(env.GEMINI_TEXT_API_KEY,
        'あなたはファクトチェッカーです。記事内の数値・固有名詞・年号の正確性を検証してください。',
        verifyPrompt
      );

      if (result.trim().startsWith('PASS')) {
        console.log('  ✅ 検証PASS: データ正確性OK');
        logs.push('- 検証: ✅ PASS');
      } else {
        console.warn(`  ⚠️  検証で問題検出:\n${result}`);
        logs.push(`- 検証: ⚠️ ${result.slice(0, 200)}`);
        // FAIL時は修正ログを残すが投稿は続行（手動確認のため）
      }
    } catch (e) {
      console.warn(`  ⚠️  検証スキップ: ${e.message}`);
      logs.push(`- 検証: スキップ (${e.message.slice(0, 50)})`);
    }
  }

  // Step 4: publish.js（git push + Buffer投稿）
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
