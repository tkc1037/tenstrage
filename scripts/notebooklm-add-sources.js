#!/usr/bin/env node
/**
 * notebooklm-add-sources.js — Research Agent が収集したURLを Tenstrage-Research に追加
 *
 * 使い方:
 *   node scripts/notebooklm-add-sources.js <url1> <url2> ...
 *   echo "https://example.com" | node scripts/notebooklm-add-sources.js
 *
 * 例（Research Agent から呼び出し）:
 *   node scripts/notebooklm-add-sources.js \
 *     https://takudora.com/article \
 *     https://takulog.info/article
 */

import { readFileSync, existsSync } from 'fs';
import { NlmSession } from './notebooklm-client.js';
import { OBSIDIAN, loadEnv } from './paths.js';

async function main() {
  const env = loadEnv();
  const researchId = env.NLM_RESEARCH_ID;

  if (!researchId) {
    console.error('❌ NLM_RESEARCH_ID が .env に未設定。先に node scripts/notebooklm-sync.js を実行してください。');
    process.exit(1);
  }

  const urls = process.argv.slice(2).filter(u => u.startsWith('http'));

  if (urls.length === 0) {
    console.log('ℹ️  URLが指定されていません。使い方: node scripts/notebooklm-add-sources.js <url1> <url2>');
    process.exit(0);
  }

  console.log(`\n📎 Tenstrage-Research に ${urls.length}件のURLを追加中...`);

  const nlm = new NlmSession();
  let added = 0;
  let summary = null;

  try {
    await nlm.connect();
    await nlm.openNotebook(researchId);
    console.log('  ✅ ノートブックオープン');

    for (const url of urls) {
      try {
        // defuddle でコンテンツを取得してテキストとして追加（URL直接より安定）
        let content = null;
        try {
          const { execSync } = await import('child_process');
          const md = execSync(`npx defuddle@0.18.1 parse "${url}" --md`, {
            encoding: 'utf8', timeout: 30000, shell: true,
          });
          content = md.trim().slice(0, 8000); // NotebookLM の上限に合わせて切り詰め
        } catch (fetchErr) {
          console.warn(`  ⚠️  defuddle 取得失敗（${url}）: ${fetchErr.message.slice(0,60)}`);
        }

        if (content && content.length > 100) {
          const hostname = new URL(url).hostname;
          const result = await nlm.addSource({ text: content, title: hostname });
          // add_source の成否を確認
          let ok = true;
          try {
            const parsed = typeof result === 'string' ? JSON.parse(result) : result;
            const data = parsed?.data ?? parsed;
            if (data?.success === false) {
              ok = false;
              console.error(`  ❌ ${url}: ${data.message ?? 'add_source returned success=false'}`);
            }
          } catch {}
          if (ok) {
            console.log(`  ✅ ${url} (text形式 ${content.length}文字)`);
            added++;
          }
        } else {
          // テキスト取得できなかった場合はURLをそのまま試みる
          const result = await nlm.addSource({ url });
          let ok = true;
          try {
            const parsed = typeof result === 'string' ? JSON.parse(result) : result;
            const data = parsed?.data ?? parsed;
            if (data?.success === false) {
              ok = false;
              console.error(`  ❌ ${url}: ${data.message ?? 'add_source returned success=false'}`);
            }
          } catch {}
          if (ok) {
            console.log(`  ✅ ${url} (URL形式)`);
            added++;
          }
        }
      } catch (e) {
        console.error(`  ❌ ${url}: ${e.message}`);
      }
    }

    // 追加後にトレンドサマリーを取得（同じセッションで）
    if (added > 0) {
      console.log('\n🔍 NotebookLM にトレンドクエリを送信中...');
      summary = await nlm.chat(
        '今日収集した情報から、タクシードライバー転職ブログの記事テーマとして' +
        '優先度の高いネタを3つ挙げてください。' +
        '検索需要・競合状況・ターゲット読者の関心度を考慮し、推奨キーワードも含めて。' +
        '箇条書き300字以内で。'
      );
    }
  } finally {
    nlm.close();
  }

  if (summary) {
    console.log('\n📊 NotebookLM トレンドサマリー:');
    console.log(summary);

    const trendsPath = `${OBSIDIAN}/feedback/trends.md`;
    if (existsSync(trendsPath)) {
      const today = new Date().toISOString().slice(0, 10);
      let trends = readFileSync(trendsPath, 'utf8');
      const section = `\n## NotebookLMリサーチサマリー（${today}）\n\n${summary}\n`;
      if (trends.includes('## NotebookLMリサーチサマリー')) {
        trends = trends.replace(/## NotebookLMリサーチサマリー[\s\S]*?(?=\n##|$)/, section);
      } else {
        trends += section;
      }
      const { writeFileSync } = await import('fs');
      writeFileSync(trendsPath, trends);
      console.log('  ✅ feedback/trends.md を更新');
    }
  }

  console.log(`\n✅ 完了: ${added}/${urls.length}件追加`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
