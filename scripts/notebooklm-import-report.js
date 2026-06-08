#!/usr/bin/env node
/**
 * notebooklm-import-report.js
 *
 * NotebookLMの5ノートから現在の知見を取得し、Obsidianのreports/へ保存する。
 * knowledge/は変更しない。取得後に人間またはエージェントが内容を確認して追記する。
 *
 * 実行:
 *   node scripts/notebooklm-import-report.js
 *   node scripts/notebooklm-import-report.js knowledge research
 *   node scripts/notebooklm-import-report.js --check
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NlmSession } from './notebooklm-client.js';
import { OBSIDIAN, loadEnv } from './paths.js';

const NOTEBOOKS = {
  knowledge: {
    envKey: 'NLM_KNOWLEDGE_ID',
    label: 'Tenstrage-Knowledge',
    destination: 'knowledge/industry.md',
    query: `このノートブックに現在蓄積されている情報から、東京のタクシードライバー転職メディアで今後参照すべき重要知識を整理してください。
給与・歩合率・勤務形態・会社選び・GOアプリ・事故や費用負担・転職時の注意点を中心に、既存情報より新しい点や具体的な数値を優先してください。
各項目に、根拠となるソース名またはURL、情報の日付が分かる場合は日付を付けてください。
不確かな情報は断定せず「要検証」と明記してください。Markdownで返してください。`,
  },
  research: {
    envKey: 'NLM_RESEARCH_ID',
    label: 'Tenstrage-Research',
    destination: 'knowledge/trends.md',
    query: `このノートブックに現在蓄積されている情報から、東京のタクシー転職市場について最新性の高いトレンドを整理してください。
検索需要、競合が扱うテーマ、求人市場、読者の悩み、記事化すべきテーマを優先してください。
古い情報と新しい情報が矛盾する場合は変更点を明記し、根拠ソース名またはURL、日付が分かる場合は日付を付けてください。
最後に記事候補を優先度付きで提示してください。Markdownで返してください。`,
  },
  video: {
    envKey: 'NLM_VIDEO_ID',
    label: 'Tenstrage-Video',
    destination: 'knowledge/video-sns.md',
    query: `このノートブックに現在蓄積されている情報から、YouTube Shorts、TikTok、Xで成果を出すための最新知識を整理してください。
冒頭フック、視聴維持、台本構成、投稿文、CTA、各プラットフォームの違いを中心に、実践可能なルールとしてまとめてください。
根拠ソース名またはURL、情報の日付が分かる場合は日付を付け、不確かな仕様は「要検証」としてください。Markdownで返してください。`,
  },
  affiliate: {
    envKey: 'NLM_AFFILIATE_ID',
    label: 'Tenstrage-Affiliate',
    destination: 'knowledge/affiliate-cvr.md',
    query: `このノートブックに現在蓄積されている情報から、転職系アフィリエイト記事のCVRを高める重要知識を整理してください。
CTA、リンク配置、比較表、信頼獲得、読者の不安解消、スマートフォン最適化を中心に、実践ルールとしてまとめてください。
根拠ソース名またはURL、情報の日付が分かる場合は日付を付け、不確かな主張は「要検証」としてください。Markdownで返してください。`,
  },
  remotion: {
    envKey: 'NLM_REMOTION_ID',
    label: 'Tenstrage-Remotion',
    destination: 'knowledge/remotion.md',
    query: `このノートブックに現在蓄積されている情報から、Remotionで縦型ショート動画を安定して制作するための重要知識を整理してください。
コンポジション設計、アニメーション、音声同期、字幕、レンダリング、性能、よくある失敗を中心に、実装可能なルールとしてまとめてください。
根拠ソース名またはURL、バージョンや日付が分かる場合は付け、古い可能性がある仕様は「要検証」としてください。Markdownで返してください。`,
  },
};

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function extractAnswer(raw) {
  if (typeof raw !== 'string') {
    return raw?.data?.answer ?? raw?.answer ?? JSON.stringify(raw, null, 2);
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed?.data?.answer ?? parsed?.answer ?? raw;
  } catch {
    return raw;
  }
}

function selectTargets(args) {
  if (args.length === 0) return Object.keys(NOTEBOOKS);
  const invalid = args.filter((key) => !(key in NOTEBOOKS));
  if (invalid.length > 0) {
    throw new Error(
      `不明なノートブック: ${invalid.join(', ')}。指定可能: ${Object.keys(NOTEBOOKS).join(', ')}`,
    );
  }
  return args;
}

async function main() {
  const env = loadEnv();
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const targets = selectTargets(args.filter((arg) => arg !== '--check'));
  const reportDir = join(OBSIDIAN, 'reports');
  const reportFile = join(reportDir, `notebooklm-import-${todayStamp()}.md`);
  const sections = [];

  if (checkOnly) {
    console.log('✅ NotebookLMインポート設定チェック');
    for (const key of targets) {
      const notebook = NOTEBOOKS[key];
      console.log(
        `  ${key}: ${env[notebook.envKey] ? 'ID設定済み' : `${notebook.envKey} 未設定`} ` +
        `→ ${notebook.destination}`,
      );
    }
    console.log(`  レポート出力先: ${reportFile}`);
    return;
  }

  mkdirSync(reportDir, { recursive: true });

  const nlm = new NlmSession();
  try {
    await nlm.connect();

    for (const key of targets) {
      const notebook = NOTEBOOKS[key];
      const notebookId = env[notebook.envKey];

      if (!notebookId) {
        sections.push(
          `## ${notebook.label}\n\n- 状態: スキップ\n- 理由: ${notebook.envKey} が未設定\n`,
        );
        continue;
      }

      console.log(`📚 ${notebook.label} を取得中...`);
      try {
        await nlm.openNotebook(notebookId);
        const raw = await nlm.chat(notebook.query);
        const answer = extractAnswer(raw);
        sections.push(
          `## ${notebook.label}\n\n` +
          `- 追記候補: \`${notebook.destination}\`\n\n` +
          `${answer.trim()}\n`,
        );
        console.log(`  ✅ ${notebook.label}`);
      } catch (error) {
        sections.push(
          `## ${notebook.label}\n\n- 状態: 取得失敗\n- エラー: ${error.message}\n`,
        );
        console.error(`  ❌ ${notebook.label}: ${error.message}`);
      }
    }
  } finally {
    nlm.close();
  }

  const generatedAt = new Date().toISOString();
  const markdown =
    `# NotebookLM Import Report — ${todayStamp()}\n\n` +
    `- 生成日時: ${generatedAt}\n` +
    `- 方針: 既存knowledgeは変更せず、追記候補のみ収集\n` +
    `- 対象: ${targets.join(', ')}\n\n` +
    `---\n\n${sections.join('\n---\n\n')}`;

  writeFileSync(reportFile, markdown, 'utf8');
  console.log(`\n✅ レポート保存: ${reportFile}`);
}

main().catch((error) => {
  console.error('❌ NotebookLM import error:', error.message);
  process.exit(1);
});
