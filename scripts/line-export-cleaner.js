#!/usr/bin/env node
/**
 * line-export-cleaner.js — LINEエクスポートを前処理してNotebookLMに追加
 *
 * 使い方:
 *   node scripts/line-export-cleaner.js data/line-exports/taxi-group.txt
 *
 * 処理内容:
 *   1. ノイズ除去（スタンプ・写真・システムメッセージ・短い相槌）
 *   2. 50万字超の場合は分割
 *   3. Tenstrage-Knowledge に自動アップロード
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { NlmSession } from './notebooklm-client.js';
import { OBSIDIAN, loadEnv } from './paths.js';
const MAX_CHARS = 450000; // NotebookLM の安全な上限

// ── ノイズ判定 ────────────────────────────────────────────────────────────────

const NOISE_PATTERNS = [
  /^\[スタンプ\]$/,
  /^\[写真\]$/,
  /^\[動画\]$/,
  /^\[ファイル\]$/,
  /^\[ボイスメッセージ\]$/,
  /^\[連絡先\]$/,
  /^\[位置情報\]$/,
  /^\[リンク\]$/,
  /^\[アルバム\]$/,
  /^\[ノート\]$/,
  /^\[投票\]$/,
  /^https?:\/\/\S+$/, // URLのみの行
];

// 短すぎる相槌（絵文字のみ・1〜5文字）
function isReaction(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length <= 4) return true; // 「笑」「了解」「おk」「👍」など
  // 絵文字のみ（U+1F000以降の文字しかない）
  const noEmoji = trimmed.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
  if (noEmoji.length === 0) return true;
  return false;
}

// 出庫・帰庫の定型挨拶
// 「出庫します。よろしくお願いします。」のような純粋な挨拶のみ除去。
// 出庫報告に有用な情報（行先・状況）が含まれる場合は残す。
const GREETING_ONLY_PATTERNS = [
  // 出庫挨拶（よろしく系）
  /^(今日も|本日も|おはようございます[。！\s]*)?出庫(します|しました|してます)[。！\s]*(よろしくお願いします[。！🙇🫡]*)?$/,
  /^出庫[。！]?よろしくお願いします[。！🙇🫡]*$/,
  /^(今日も|本日も)?よろしくお願いします[。！🙇🫡]*$/,
  /^(おはようございます|おはようございます[。！]+)[。！\s]*(よろしくお願いします[。！🙇🫡]*)?$/,
  // 帰庫挨拶（全完・お疲れ系）
  /^全完(です)?[。！\s]*(お疲れ様(でした)?[。！🙇]*)?$/,
  /^(今日も|本日も)?お疲れ様(でした)?[。！\s]*(ありがとうございました[。！]*)?$/,
  /^帰庫(します|しました)[。！\s]*(お疲れ様(でした)?[。！]*)?$/,
  /^上がります[。！\s]*(お疲れ様(でした)?[。！]*)?$/,
  /^お疲れ様(でした)?[。！🙇]*$/,
  /^ありがとうございました[。！🙇]*$/,
  // 短い定型文（単体）
  /^(おつかれ|おつかれ様|お疲れ|ご安全に)[。！！]*$/,
];

function isGreetingOnly(text) {
  const t = text.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
  return GREETING_ONLY_PATTERNS.some(p => p.test(t));
}

function isNoise(text) {
  const t = text.trim();
  if (!t) return true;
  if (NOISE_PATTERNS.some(p => p.test(t))) return true;
  if (isReaction(t)) return true;
  if (isGreetingOnly(t)) return true;
  return false;
}

// ── パース ─────────────────────────────────────────────────────────────────────

function parse(raw) {
  const lines = raw.split('\n');
  const messages = [];
  let currentDate = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 日付ヘッダー: 2024/12/04(水)
    if (/^\d{4}\/\d{2}\/\d{2}\(.\)$/.test(trimmed)) {
      currentDate = trimmed;
      continue;
    }

    // メッセージ行: HH:MM\t名前\t内容
    const parts = trimmed.split('\t');
    if (parts.length < 3) continue;

    const time = parts[0];
    const name = parts[1];
    const content = parts.slice(2).join('\t').trim().replace(/^"|"$/g, '').trim();

    // 時刻フォーマットチェック
    if (!/^\d{1,2}:\d{2}$/.test(time)) continue;

    // 名前が空 = システムメッセージ（招待・参加等）
    if (!name) continue;

    // ノイズ除去
    if (isNoise(content)) continue;

    messages.push({ date: currentDate, time, name, content });
  }

  return messages;
}

// ── フォーマット ───────────────────────────────────────────────────────────────

function format(messages) {
  const chunks = [];
  let current = '';
  let lastDate = '';

  for (const { date, time, name, content } of messages) {
    if (date !== lastDate) {
      current += `\n【${date}】\n`;
      lastDate = date;
    }
    const line = `${time} ${name}: ${content}\n`;

    if ((current + line).length > MAX_CHARS) {
      chunks.push(current.trim());
      current = `【${date}】（続き）\n` + line;
    } else {
      current += line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ── メイン ────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2];
  if (!filePath || !existsSync(filePath)) {
    console.error('使い方: node scripts/line-export-cleaner.js <LINEエクスポートファイル.txt>');
    process.exit(1);
  }

  console.log(`\n📱 LINE エクスポート処理: ${filePath}`);

  const raw = readFileSync(filePath, 'utf8');
  const messages = parse(raw);

  console.log(`  元のメッセージ数: ${raw.split('\n').filter(l => /^\d{1,2}:\d{2}\t.+\t/.test(l.trim())).length}`);
  console.log(`  ノイズ除去後:    ${messages.length} 件`);

  if (messages.length === 0) {
    console.error('❌ 有効なメッセージが見つかりませんでした');
    process.exit(1);
  }

  const chunks = format(messages);
  console.log(`  分割数:          ${chunks.length} チャンク`);

  // デバッグ用: クリーニング済みファイルを保存
  const debugPath = filePath.replace(/\.txt$/, '-cleaned.txt');
  writeFileSync(debugPath, chunks.join('\n\n===== 続き =====\n\n'), 'utf8');
  console.log(`  クリーニング済み: ${debugPath}`);

  // NotebookLM にアップロード
  const env = loadEnv();
  const notebookId = env.NLM_KNOWLEDGE_ID;
  if (!notebookId) {
    console.error('❌ NLM_KNOWLEDGE_ID が .env に未設定');
    process.exit(1);
  }

  const fileBase = basename(filePath, '.txt');
  const nlm = new NlmSession();
  let uploaded = 0;

  try {
    await nlm.connect();
    await nlm.openNotebook(notebookId);
    console.log('\n📓 Tenstrage-Knowledge にアップロード中...');

    for (let i = 0; i < chunks.length; i++) {
      const title = chunks.length === 1
        ? `LINE_${fileBase}`
        : `LINE_${fileBase}_part${i + 1}`;

      try {
        const result = await nlm.addSource({ text: chunks[i], title });
        let ok = true;
        try {
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          const data = parsed?.data ?? parsed;
          if (data?.success === false) {
            ok = false;
            console.error(`  ❌ ${title}: ${data.message ?? 'add_source returned success=false'}`);
          }
        } catch { /* ignore */ }
        if (ok) {
          console.log(`  ✅ ${title} (${chunks[i].length.toLocaleString()}字)`);
          uploaded++;
        }
      } catch (e) {
        console.error(`  ❌ ${title}: ${e.message}`);
      }
    }
  } finally {
    nlm.close();
  }

  console.log(`\n✅ 完了: ${uploaded}/${chunks.length} チャンク追加`);
  if (uploaded > 0) {
    console.log('\n次のステップ:');
    console.log('  node scripts/notebooklm-research.js knowledge');
    console.log('  → knowledge/industry.md が現場の生の声で更新されます');
  }
}

main().catch(e => { console.error('❌', e); process.exit(1); });
