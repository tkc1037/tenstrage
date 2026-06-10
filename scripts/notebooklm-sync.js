#!/usr/bin/env node
/**
 * notebooklm-sync.js — Tenstrage-Knowledge ノートブックに静的ファイルをアップロード
 *
 * 実行: node scripts/notebooklm-sync.js
 *
 * アップロード対象:
 *   - CLAUDE.md（プロジェクトルール）
 *   - knowledge.md（現場情報）
 *   - quality/article-guidelines.md
 *   - quality/seo-guidelines.md
 *   - quality/sns-rules.md
 *
 * 初回セットアップ時に1回実行。ファイル更新時も再実行可。
 */

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { NlmSession } from './notebooklm-client.js';
import { OBSIDIAN, loadEnv } from './paths.js';

function saveEnv(key, value) {
  const envPath = `${OBSIDIAN}/.env`;
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  writeFileSync(envPath, content);
  console.log(`  📝 .env に ${key} を保存`);
}

async function main() {
  console.log('🔄 NotebookLM 同期開始...\n');
  const env = loadEnv();

  const knowledgeId = env.NLM_KNOWLEDGE_ID;
  const researchId  = env.NLM_RESEARCH_ID;

  if (!knowledgeId || !researchId) {
    console.error('❌ NLM_KNOWLEDGE_ID または NLM_RESEARCH_ID が .env に未設定');
    process.exit(1);
  }

  // ─── アップロード対象を自動収集 ──────────────────────────
  const knowledgeFiles = [
    { path: `${OBSIDIAN}/CLAUDE.md`,                        title: 'CLAUDE.md - プロジェクトルール' },
    { path: `${OBSIDIAN}/quality/article-guidelines.md`,    title: 'article-guidelines.md - 記事品質ルール' },
    { path: `${OBSIDIAN}/quality/seo-guidelines.md`,        title: 'seo-guidelines.md - SEOルール' },
    { path: `${OBSIDIAN}/quality/sns-rules.md`,             title: 'sns-rules.md - SNSルール' },
  ];

  // knowledge/ 配下の全.mdファイルを自動追加
  const knowledgeDir = join(OBSIDIAN, 'knowledge');
  if (existsSync(knowledgeDir)) {
    const mdFiles = readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
    for (const file of mdFiles) {
      knowledgeFiles.push({
        path: join(knowledgeDir, file),
        title: `knowledge/${file}`,
      });
    }
    console.log(`  📂 knowledge/ ${mdFiles.length}ファイル検出: ${mdFiles.join(', ')}`);
  }

  console.log('📚 NotebookLM に接続中...');
  const nlm = new NlmSession();
  try {
    await nlm.connect();
    console.log('  ✅ 接続完了');

    console.log(`\n📖 Tenstrage-Knowledge を開く中...`);
    await nlm.openNotebook(knowledgeId);
    console.log('  ✅ ノートブックオープン');

    console.log('\n📤 ファイルをアップロード中...');
    for (const { path, title } of knowledgeFiles) {
      if (!existsSync(path)) {
        console.warn(`  ⚠️  スキップ（ファイルなし）: ${path}`);
        continue;
      }
      try {
        const text = readFileSync(path, 'utf8');
        await nlm.addSource({ text, title });
        console.log(`  ✅ ${title}`);
      } catch (e) {
        console.error(`  ❌ ${title}: ${e.message}`);
      }
    }
  } finally {
    nlm.close();
  }

  console.log('\n🎉 NotebookLM 同期完了！');
  console.log(`  Knowledge ID: ${env.NLM_KNOWLEDGE_ID}`);
  console.log(`  Research ID:  ${env.NLM_RESEARCH_ID}`);
  console.log('\n次のステップ:');
  console.log('  node scripts/pipeline.js  ← NotebookLM連携済みパイプライン実行');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
