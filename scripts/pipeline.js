#!/usr/bin/env node
/**
 * pipeline.js — 公開パイプライン（コンテキスト確認 + publish）
 *
 * 実行: node scripts/pipeline.js
 *
 * 記事・SNSの生成は Claude Code / Codex で対話的に行う。
 * このスクリプトは生成済みコンテンツの確認と公開のみ担当。
 *
 * ステップ:
 *   1. 今日の生成済みコンテンツを確認
 *   2. publish.js 実行（git push + Buffer投稿）
 *   3. log.md に記録
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { ROOT, OBSIDIAN } from './paths.js';

// ─── 今日の生成済みコンテンツ確認 ────────────────────────────
function checkTodaysContent(today) {
  const dateStr = today.replace(/-/g, '');
  const articlesDir = join(ROOT, 'src', 'content', 'articles');
  const draftsDir = join(ROOT, 'sns-drafts');

  const articles = existsSync(articlesDir)
    ? readdirSync(articlesDir).filter(f => f.startsWith(dateStr) && f.endsWith('.md'))
    : [];

  const snsDraft = existsSync(join(draftsDir, `${dateStr}.md`));

  return { articles, snsDraft, dateStr };
}

// ─── log.md 記録 ─────────────────────────────────────────────
function appendLog(entries) {
  const logPath = join(OBSIDIAN, 'log.md');
  const existing = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const today = new Date().toISOString().slice(0, 10);
  const entry = `\n## [${today}] pipeline | 公開実行\n${entries.join('\n')}\n`;
  writeFileSync(logPath, existing + entry);
}

// ─── メイン ───────────────────────────────────────────────
async function main() {
  console.log('🚀 pipeline.js 開始（公開モード）');
  const start = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const logs = [];

  // Step 1: 今日のコンテンツ確認
  const { articles, snsDraft, dateStr } = checkTodaysContent(today);
  console.log(`\n📋 今日のコンテンツ確認（${today}）:`);
  console.log(`  記事: ${articles.length}本`);
  articles.forEach(f => console.log(`    - ${f}`));
  console.log(`  SNSドラフト: ${snsDraft ? '✅' : '❌ なし'}`);

  if (articles.length === 0 && !snsDraft) {
    console.log('\n⚠️  公開するコンテンツがありません。');
    console.log('  記事生成: Claude Code で /article-agent を実行');
    console.log('  SNS生成:  Claude Code で /sns-agent を実行');
    return;
  }

  articles.forEach(f => logs.push(`- 記事: ${f}`));
  if (snsDraft) logs.push(`- SNSドラフト: sns-drafts/${dateStr}.md`);

  // Step 2: publish.js（git push + Buffer投稿）
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
  appendLog(logs);
  console.log(`\n✅ pipeline.js 完了（${elapsed}秒）`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
