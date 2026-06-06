#!/usr/bin/env node
/**
 * notebooklm-research.js — 専門ノートにクエリを送り Obsidian の knowledge/ に保存
 *
 * 使い方:
 *   node scripts/notebooklm-research.js          # 全ノートを更新
 *   node scripts/notebooklm-research.js video     # video のみ
 *   node scripts/notebooklm-research.js affiliate remotion  # 複数指定
 *
 * 出力先:
 *   Obsidian/knowledge/industry.md
 *   Obsidian/knowledge/trends.md
 *   Obsidian/knowledge/video-sns.md
 *   Obsidian/knowledge/affiliate-cvr.md
 *   Obsidian/knowledge/remotion.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { NlmSession } from './notebooklm-client.js';
import { OBSIDIAN, loadEnv } from './paths.js';

const KNOWLEDGE_DIR = `${OBSIDIAN}/knowledge`;

// ── ノート定義 ────────────────────────────────────────────────────────────────

function buildNotebooks(env) {
  return {
    knowledge: {
      id: env.NLM_KNOWLEDGE_ID,
      outputFile: `${KNOWLEDGE_DIR}/industry.md`,
      label: 'Tenstrage-Knowledge → industry.md',
      queries: [
        {
          key: 'salary',
          title: '給与・年収データ',
          q: '東京タクシードライバーの給与・年収の実態を整理してください。' +
             '歩合率・給与保証・入社祝い金・月収シミュレーションを具体的な数字で。' +
             '箇条書き400字以内。',
        },
        {
          key: 'working_conditions',
          title: '勤務形態・待遇',
          q: '隔日勤務・日勤・夜勤の違いと、それぞれの実収入・メリット・デメリットを整理してください。' +
             '箇条書き400字以内。',
        },
        {
          key: 'go_app',
          title: 'GOアプリ活用術',
          q: 'GOアプリ・サンキューチケット・連続配車ボーナスなど、収入を上げる具体的な活用法を整理してください。' +
             '実際の数字・金額を含めて。箇条書き400字以内。',
        },
        {
          key: 'risks',
          title: 'リスク・デメリット',
          q: 'タクシー転職でよくある失敗・後悔・デメリットを整理してください。' +
             '事故負担金・体力・稼ぎのバラつきなど。箇条書き300字以内。',
        },
      ],
    },

    research: {
      id: env.NLM_RESEARCH_ID,
      outputFile: `${KNOWLEDGE_DIR}/trends.md`,
      label: 'Tenstrage-Research → trends.md',
      queries: [
        {
          key: 'trending_keywords',
          title: '注目キーワード',
          q: '現在の検索トレンドで、タクシー転職ブログが狙うべきキーワードを優先度順に挙げてください。' +
             '月間検索数の目安・競合難易度も含めて。箇条書き400字以内。',
        },
        {
          key: 'competitor_analysis',
          title: '競合分析',
          q: 'タクシー転職ブログの競合サイトの特徴と、差別化ポイントを整理してください。' +
             '個人サイトが勝てる領域・戦略を含めて。箇条書き400字以内。',
        },
        {
          key: 'article_topics',
          title: '記事ネタ（優先度順）',
          q: '今月書くべき記事テーマを3〜5つ、検索需要・競合状況・ターゲット読者の関心度を考慮して提案してください。' +
             '推奨タイトル案・メインキーワードも含めて。箇条書き500字以内。',
        },
      ],
    },

    video: {
      id: env.NLM_VIDEO_ID,
      outputFile: `${KNOWLEDGE_DIR}/video-sns.md`,
      label: 'Tenstrage-Video → video-sns.md',
      queries: [
        {
          key: 'shorts_algorithm',
          title: 'YouTube Shortsアルゴリズム',
          q: 'YouTube Shortsのアルゴリズムで、視聴維持率・CTR・エンゲージメントを上げるための最重要ポイントを整理してください。' +
             '2025〜2026年の最新情報で。箇条書き400字以内。',
        },
        {
          key: 'tiktok_algorithm',
          title: 'TikTokアルゴリズム',
          q: 'TikTokのアルゴリズムで、完全視聴率・リピート再生・フォロー率を上げるための最重要ポイントを整理してください。' +
             '2025〜2026年の最新情報で。箇条書き400字以内。',
        },
        {
          key: 'x_algorithm',
          title: 'X（Twitter）アルゴリズム',
          q: 'Xのアルゴリズムで、インプレッション・エンゲージメント・フォロワー増加のための最重要ポイントを整理してください。' +
             '外部リンクの扱い・動画投稿の効果も含めて。箇条書き400字以内。',
        },
        {
          key: 'hook_design',
          title: '冒頭フック設計',
          q: '動画・SNS投稿の冒頭3秒で視聴者を掴む、心理トリガー別のフック設計パターンを整理してください。' +
             'タクシー転職コンテンツへの適用例付きで。箇条書き400字以内。',
        },
        {
          key: 'script_patterns',
          title: '台本・投稿パターン',
          q: '短尺動画（30秒・60秒）とSNS投稿で高パフォーマンスを出している台本・文章構成パターンを整理してください。' +
             'ループ設計・CTA最適化も含めて。箇条書き400字以内。',
        },
      ],
    },

    affiliate: {
      id: env.NLM_AFFILIATE_ID,
      outputFile: `${KNOWLEDGE_DIR}/affiliate-cvr.md`,
      label: 'Tenstrage-Affiliate → affiliate-cvr.md',
      queries: [
        {
          key: 'cvr_optimization',
          title: 'CVR最適化',
          q: 'アフィリエイトブログのCVR（成約率）を上げるための最重要ポイントを整理してください。' +
             '転職系アフィリエイトに特化した内容で。箇条書き400字以内。',
        },
        {
          key: 'cta_design',
          title: 'CTA設計',
          q: '転職系アフィリエイトで効果的なCTAボタン・テキスト・配置のパターンを整理してください。' +
             'モバイル最適化・心理トリガーも含めて。箇条書き400字以内。',
        },
        {
          key: 'link_placement',
          title: 'リンク配置戦略',
          q: 'アフィリエイトリンクの最適な配置位置・タイミング・本数を整理してください。' +
             '読者の行動フローに基づいた自然な埋め込み方法も含めて。箇条書き400字以内。',
        },
        {
          key: 'trust_building',
          title: '信頼獲得・E-E-A-T',
          q: '転職系アフィリエイトで読者の信頼を獲得し、成約につなげるコンテンツ設計パターンを整理してください。' +
             'デメリット開示・実体験引用の効果も含めて。箇条書き400字以内。',
        },
      ],
    },

    remotion: {
      id: env.NLM_REMOTION_ID,
      outputFile: `${KNOWLEDGE_DIR}/remotion.md`,
      label: 'Tenstrage-Remotion → remotion.md',
      queries: [
        {
          key: 'composition_design',
          title: 'コンポジション設計',
          q: 'Remotionで短尺動画（30〜60秒）を作るためのコンポジション設計のベストプラクティスを整理してください。' +
             'FPS・解像度・タイムライン構成を含めて。箇条書き400字以内。',
        },
        {
          key: 'animation_patterns',
          title: 'テロップ・アニメーション',
          q: 'Remotionでテロップ・タイトル・テキストアニメーションを実装するパターンを整理してください。' +
             '短尺動画でよく使われるエフェクト・トランジションも含めて。箇条書き400字以内。',
        },
        {
          key: 'audio_sync',
          title: '音声同期・TTS連携',
          q: 'RemotionでTTS音声ファイルと映像を同期させる実装パターンを整理してください。' +
             'useCurrentFrame・interpolate・Audio コンポーネントの活用方法を含めて。箇条書き400字以内。',
        },
        {
          key: 'rendering',
          title: 'レンダリング・出力',
          q: 'Remotionのrenderコマンド・出力設定・パフォーマンス最適化のベストプラクティスを整理してください。' +
             'GitHub Actions / CLI での自動化も含めて。箇条書き400字以内。',
        },
      ],
    },
  };
}

// ── メイン処理 ────────────────────────────────────────────────────────────────

async function queryNotebook(nlm, notebookId, queries) {
  await nlm.openNotebook(notebookId);

  const results = {};
  let sessionId = null;

  for (const { key, title, q } of queries) {
    try {
      const raw = await nlm.chat(q, sessionId);
      // chat が直接テキストを返す場合と JSON の場合を両対応
      let answer = raw;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          const data = parsed?.data ?? parsed;
          if (data?.answer) {
            answer = data.answer;
            sessionId = data.session_id ?? sessionId;
          }
        } catch { /* テキストのまま使う */ }
      } else if (raw?.data?.answer) {
        answer = raw.data.answer;
        sessionId = raw.data.session_id ?? sessionId;
      }
      results[key] = { title, answer };
      process.stdout.write(`    ✅ ${title}\n`);
    } catch (e) {
      results[key] = { title, answer: `（取得失敗: ${e.message}）` };
      process.stdout.write(`    ⚠️  ${title}: ${e.message.slice(0, 60)}\n`);
    }
  }

  return results;
}

function buildMarkdown(label, results) {
  const today = new Date().toISOString().slice(0, 10);
  let md = `# ${label}\n\n_最終更新: ${today}_\n\n---\n\n`;
  for (const { title, answer } of Object.values(results)) {
    md += `## ${title}\n\n${answer}\n\n---\n\n`;
  }
  return md;
}

async function main() {
  const env = loadEnv();
  const notebooks = buildNotebooks(env);

  // フィルタ: 引数で絞り込み（未指定なら全件）
  const targets = process.argv.slice(2).filter(Boolean);
  const keys = targets.length > 0
    ? targets.filter(k => k in notebooks)
    : Object.keys(notebooks);

  if (keys.length === 0) {
    console.error('❌ 有効なノート名が指定されていません:', targets.join(', '));
    console.error('   使用可能:', Object.keys(notebooks).join(', '));
    process.exit(1);
  }

  // knowledge/ ディレクトリ作成
  if (!existsSync(KNOWLEDGE_DIR)) {
    mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    console.log(`📁 ${KNOWLEDGE_DIR} を作成`);
  }

  console.log(`\n🔬 NotebookLM リサーチ開始 (${keys.length}ノート)\n`);

  const nlm = new NlmSession();
  try {
    await nlm.connect();

    for (const key of keys) {
      const nb = notebooks[key];
      if (!nb.id) {
        console.warn(`  ⚠️  ${key}: .env に IDが未設定 (NLM_${key.toUpperCase()}_ID)`);
        continue;
      }

      console.log(`\n📓 ${nb.label}`);
      const results = await queryNotebook(nlm, nb.id, nb.queries);
      const md = buildMarkdown(nb.label.split(' → ')[0], results);
      writeFileSync(nb.outputFile, md, 'utf8');
      console.log(`  💾 保存: ${nb.outputFile}`);
    }
  } finally {
    nlm.close();
  }

  console.log('\n✅ 全ノートのリサーチ完了');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
