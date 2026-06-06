#!/usr/bin/env node
/**
 * batch-runner.js — Anthropic Batch API でトークン50%削減
 *
 * 使用方法:
 *   node scripts/batch-runner.js article   ← 記事3本をバッチ投入
 *   node scripts/batch-runner.js sns       ← SNS投稿5本をバッチ投入
 *   node scripts/batch-runner.js check <batchId>  ← 結果確認
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OBSIDIAN, loadEnv } from './paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BATCH_LOG = join(__dirname, 'batch-log.json');

// ─── コンテキスト読み込み ────────────────────────────────
function loadContext() {
  const knowledge  = readFileSync(`${OBSIDIAN}/knowledge/industry.md`, 'utf8');
  const seoRules   = readFileSync(`${OBSIDIAN}/quality/seo-rules.md`, 'utf8');
  const writingRules = readFileSync(`${OBSIDIAN}/quality/writing-rules.md`, 'utf8');
  const snsRules   = readFileSync(`${OBSIDIAN}/quality/sns-rules.md`, 'utf8');
  const trends     = readFileSync(`${OBSIDIAN}/feedback/trends.md`, 'utf8');
  const today      = new Date().toISOString().slice(0, 10);
  return { knowledge, seoRules, writingRules, snsRules, trends, today };
}

// ─── バッチリクエスト構築 ────────────────────────────────
function buildArticleRequests(ctx) {
  const system = `あなたはタクシードライバー転職情報ライターです。
以下の情報を参照して記事を生成してください。

## knowledge.md
${ctx.knowledge}

## SEOルール
${ctx.seoRules}

## 品質ルール
${ctx.writingRules}

## トレンド
${ctx.trends}`;

  const themes = [
    'feedback/trends.mdの優先度高テーマ1つ目',
    'feedback/trends.mdの優先度高テーマ2つ目',
    'feedback/trends.mdの優先度高テーマ3つ目',
  ];

  return themes.map((theme, i) => ({
    custom_id: `article_${i + 1}_${ctx.today.replace(/-/g, '')}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system,
      messages: [{
        role: 'user',
        content: `feedback/trends.mdの優先度高テーマ${i + 1}番目を選んで記事を1本書いてください。
出力形式（Astro frontmatter付きMarkdown）：
---
title: "タイトル"
description: "メタ説明120〜160文字"
pubDate: ${ctx.today}
tags: ["タクシー転職", "東京"]
---
本文（2000字以上）`,
      }],
    },
  }));
}

function buildSnsRequests(ctx) {
  const system = `あなたはSNSコピーライターです。
以下の情報を参照して投稿文を生成してください。

## knowledge.md
${ctx.knowledge}

## SNSルール
${ctx.snsRules}

## トレンド
${ctx.trends}`;

  const types = [
    { id: 'x_article', platform: 'X', type: '記事紹介（URLあり）', chars: '280文字以内、ハッシュタグ3個以内' },
    { id: 'x_tips',    platform: 'X', type: '役立ちTips（URLなし）', chars: '280文字以内、ハッシュタグ3個以内' },
    { id: 'x_question', platform: 'X', type: '質問投稿（エンゲージメント狙い）', chars: '280文字以内、ハッシュタグ3個以内' },
    { id: 'tiktok_1',  platform: 'TikTok', type: 'テロップ構成（45〜180秒）', chars: '完視聴率45%目標' },
    { id: 'youtube_1', platform: 'YouTube Shorts', type: '冒頭15秒キャッチ型', chars: '15〜60秒、CTR 8%目標' },
  ];

  return types.map(t => ({
    custom_id: `${t.id}_${ctx.today.replace(/-/g, '')}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{
        role: 'user',
        content: `${t.platform}用「${t.type}」を1本生成してください。条件：${t.chars}。knowledge.mdの現場情報を1箇所以上引用。投稿本文のみ出力。`,
      }],
    },
  }));
}

// ─── バッチ投入 ──────────────────────────────────────────
async function submitBatch(requests, client) {
  console.log(`📤 バッチ投入: ${requests.length}件`);
  const batch = await client.messages.batches.create({ requests });
  console.log(`✅ バッチID: ${batch.id}`);
  console.log(`📊 状態: ${batch.processing_status}`);
  console.log(`\n💡 確認: node scripts/batch-runner.js check ${batch.id}`);

  const log = existsSync(BATCH_LOG) ? JSON.parse(readFileSync(BATCH_LOG, 'utf8')) : [];
  log.push({ timestamp: new Date().toISOString(), batchId: batch.id, count: requests.length });
  writeFileSync(BATCH_LOG, JSON.stringify(log, null, 2));
  return batch.id;
}

// ─── 結果確認 ────────────────────────────────────────────
async function checkBatch(batchId, client) {
  const batch = await client.messages.batches.retrieve(batchId);
  console.log(`📊 状態: ${batch.processing_status}`);
  console.log(`✅ 完了: ${batch.request_counts.succeeded}`);
  console.log(`❌ 失敗: ${batch.request_counts.errored}`);
  console.log(`⏳ 処理中: ${batch.request_counts.processing}`);

  if (batch.processing_status === 'ended') {
    console.log('\n結果取得中...');
    for await (const result of await client.messages.batches.results(batchId)) {
      if (result.result.type === 'succeeded') {
        console.log(`\n✅ ${result.custom_id}`);
        console.log(result.result.message.content[0].text.slice(0, 200) + '...');
      } else {
        console.log(`\n❌ ${result.custom_id}: ${result.result.error?.message}`);
      }
    }
  }
}

// ─── メイン ──────────────────────────────────────────────
async function main() {
  const env = loadEnv();
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const [command, param] = process.argv.slice(2);

  if (!command) {
    console.log('使用方法: node scripts/batch-runner.js <article|sns|check> [batchId]');
    process.exit(0);
  }

  if (command === 'check') {
    if (!param) { console.error('❌ バッチIDを指定してください'); process.exit(1); }
    await checkBatch(param, client);
    return;
  }

  const ctx = loadContext();
  const requests = command === 'article' ? buildArticleRequests(ctx)
                 : command === 'sns'     ? buildSnsRequests(ctx)
                 : null;

  if (!requests) { console.error(`❌ タスク '${command}' は不正 (article|sns)`); process.exit(1); }
  await submitBatch(requests, client);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
