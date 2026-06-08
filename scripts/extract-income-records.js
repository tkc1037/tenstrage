#!/usr/bin/env node
/**
 * extract-income-records.js — 収入記録写真を Gemini Flash で解析
 *
 * 使い方:
 *   node scripts/extract-income-records.js
 *
 * 入力: data/income-records/ 内の全画像（jpg/jpeg/png/webp）
 * 出力: knowledge/income-records.md
 *
 * 対応書類:
 *   - 給与明細書
 *   - タブレット営業履歴詳細
 *   - 住民税通知書・所得証明
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { extname, basename, join } from 'path';
import { ROOT, OBSIDIAN, loadEnv } from './paths.js';

const INPUT_DIR = join(ROOT, 'data/income-records');
const OUTPUT_FILE = join(OBSIDIAN, 'knowledge/income-records.md');
const PROCESSED_LOG = join(ROOT, 'data/income-records/.processed.json');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);

const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
  '.heic': 'image/heic',
};

// ── Gemini API 呼び出し ────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `この画像はタクシードライバーの収入・業務記録です。
画像の種類を自動判定し、以下のいずれかのJSON形式でデータを抽出してください。
個人名・口座番号・住所などの個人識別情報は除外してください。

【給与明細書の場合】
{"type":"給与明細","year_month":"YYYY年MM月","company":"会社名（個人名除外）","total_gross":総支給額,"net_pay":差引支給額,"base_salary":基本給,"night_allowance":深夜手当,"overtime":時間外手当,"no_accident_bonus":無事故手当,"compliance_bonus":遵法手当,"ride_allowance":乗務手当,"diligence_bonus":精勤手当,"public_work_allowance":公出手当,"ride_count":完全乗務数,"simulated_sales":仮想営収,"actual_sales":給与総営収,"public_sales":公出営収}

【タブレット営業履歴詳細の場合】
{"type":"営業履歴","ride_number":乗車番号,"boarding_time":"HH:MM","alighting_time":"HH:MM","origin":"乗車地（区・市レベル）","destination":"降車地（区・市レベル）","meter_fare":メーター運賃,"highway_fee":高速料金,"discount":割引,"total":合計}

【住民税通知書・所得証明の場合】
{"type":"所得証明","fiscal_year":"令和X年度","gross_income":給与収入,"taxable_income":総所得金額}

JSONのみ返してください。必ず \`\`\`json と \`\`\` で囲んでください。数値はカンマなしの整数で。`;

async function callGemini(apiKey, imageBase64, mimeType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const headers = { 'Content-Type': 'application/json' };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: EXTRACTION_PROMPT },
        ],
      }],
      generationConfig: { temperature: 0.1 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseGeminiResponse(text) {
  const m = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// ── マークダウン生成 ──────────────────────────────────────────────────────────

function formatRecord(rec) {
  if (!rec) return '（解析失敗）';

  if (rec.type === '給与明細') {
    return [
      `**${rec.year_month}** — ${rec.company ?? ''}`,
      `- 総支給額: **${rec.total_gross?.toLocaleString()}円**`,
      `- 差引支給額: ${rec.net_pay?.toLocaleString()}円`,
      `- 基本給: ${rec.base_salary?.toLocaleString()}円`,
      rec.night_allowance   ? `- 深夜手当: ${rec.night_allowance.toLocaleString()}円` : '',
      rec.overtime          ? `- 時間外手当: ${rec.overtime.toLocaleString()}円` : '',
      rec.no_accident_bonus ? `- 無事故手当: ${rec.no_accident_bonus.toLocaleString()}円` : '',
      rec.compliance_bonus  ? `- 遵法手当: ${rec.compliance_bonus.toLocaleString()}円` : '',
      rec.ride_count        ? `- 完全乗務数: ${rec.ride_count}回` : '',
      rec.actual_sales      ? `- 給与総営収: ${rec.actual_sales.toLocaleString()}円` : '',
      rec.simulated_sales   ? `- 仮想営収: ${rec.simulated_sales.toLocaleString()}円` : '',
    ].filter(Boolean).join('\n');
  }

  if (rec.type === '営業履歴') {
    return [
      `**No.${rec.ride_number}** ${rec.boarding_time}乗車 → ${rec.alighting_time}降車`,
      `- 乗車地: ${rec.origin} → 降車地: ${rec.destination}`,
      `- メーター運賃: ${rec.meter_fare?.toLocaleString()}円`,
      rec.highway_fee ? `- 高速代: ${rec.highway_fee.toLocaleString()}円` : '',
      rec.discount    ? `- 割引: -${rec.discount.toLocaleString()}円` : '',
      `- **合計: ${rec.total?.toLocaleString()}円**`,
    ].filter(Boolean).join('\n');
  }

  if (rec.type === '所得証明') {
    return [
      `**${rec.fiscal_year}**`,
      `- 給与収入: **${rec.gross_income?.toLocaleString()}円**`,
      `- 総所得金額: ${rec.taxable_income?.toLocaleString()}円`,
    ].filter(Boolean).join('\n');
  }

  return JSON.stringify(rec, null, 2);
}

// ── メイン ────────────────────────────────────────────────────────────────────

async function main() {
  const env = loadEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY が .env に未設定');

  // 処理済みログ
  const processed = existsSync(PROCESSED_LOG)
    ? JSON.parse(readFileSync(PROCESSED_LOG, 'utf8'))
    : {};

  // 画像ファイル一覧
  const files = readdirSync(INPUT_DIR)
    .filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  const newFiles = files.filter(f => !processed[f]);
  console.log(`\n📸 収入記録解析 (${files.length}件中 ${newFiles.length}件が未処理)\n`);

  if (newFiles.length === 0) {
    console.log('✅ 全ファイル処理済み。knowledge/income-records.md は最新です。');
    return;
  }

  const results = { 給与明細: [], 営業履歴: [], 所得証明: [], 不明: [] };

  // 既存の処理済み結果を読み込む
  if (existsSync(OUTPUT_FILE)) {
    // 追記モードのため既存ファイルはそのまま残す
  }

  let done = 0;
  for (const file of newFiles) {
    const filePath = `${INPUT_DIR}/${file}`;
    const ext = extname(file).toLowerCase();
    const mimeType = MIME_MAP[ext] ?? 'image/jpeg';

    try {
      const imageBase64 = readFileSync(filePath).toString('base64');
      const rawText = await callGemini(apiKey, imageBase64, mimeType);
      const record = parseGeminiResponse(rawText);

      if (record) {
        record._file = file;
        const category = record.type ?? '不明';
        (results[category] ?? results['不明']).push(record);
        console.log(`  ✅ ${file} → ${category}`);
      } else {
        results['不明'].push({ _file: file, _raw: rawText.slice(0, 200) });
        console.log(`  ⚠️  ${file} → 解析失敗`);
      }

      processed[file] = new Date().toISOString();
      done++;

      // レート制限対策（無料枠: 15 RPM）
      if (done % 10 === 0) {
        process.stdout.write('  💤 レート制限対策で5秒待機...\n');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error(`  ❌ ${file}: ${e.message}`);
    }
  }

  // ── マークダウン生成 ──────────────────────────────────────────────────────

  const today = new Date().toISOString().slice(0, 10);
  let md = `# 収入・営業記録データ\n\n_最終更新: ${today}_\n\n`;
  md += `> Gemini Flash で自動抽出。個人識別情報は除外済み。\n\n---\n\n`;

  // 給与明細サマリー
  if (results['給与明細'].length > 0) {
    const sorted = results['給与明細'].sort((a, b) =>
      (a.year_month ?? '').localeCompare(b.year_month ?? ''));
    md += `## 給与明細（${sorted.length}件）\n\n`;
    const totalNet = sorted.reduce((s, r) => s + (r.net_pay ?? 0), 0);
    const avgNet = Math.round(totalNet / sorted.length);
    md += `**平均手取り: ${avgNet.toLocaleString()}円/月**\n\n`;
    for (const r of sorted) {
      md += `### ${r.year_month ?? r._file}\n\n${formatRecord(r)}\n\n`;
    }
    md += `---\n\n`;
  }

  // 所得証明
  if (results['所得証明'].length > 0) {
    md += `## 年収証明（${results['所得証明'].length}件）\n\n`;
    for (const r of results['所得証明'].sort((a, b) =>
      (a.fiscal_year ?? '').localeCompare(b.fiscal_year ?? ''))) {
      md += `### ${r.fiscal_year ?? r._file}\n\n${formatRecord(r)}\n\n`;
    }
    md += `---\n\n`;
  }

  // 営業履歴（ロング乗車抜粋 10,000円以上）
  if (results['営業履歴'].length > 0) {
    const longRides = results['営業履歴']
      .filter(r => (r.total ?? 0) >= 10000)
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const allRides = results['営業履歴'];

    md += `## 営業履歴（${allRides.length}件）\n\n`;
    md += `**ロング乗車（10,000円以上）: ${longRides.length}件**\n\n`;

    if (longRides.length > 0) {
      md += `### 高額乗車記録\n\n`;
      for (const r of longRides.slice(0, 20)) {
        md += `${formatRecord(r)}\n\n`;
      }
    }
    md += `---\n\n`;
  }

  // 不明
  if (results['不明'].length > 0) {
    md += `## 解析未対応（${results['不明'].length}件）\n\n`;
    for (const r of results['不明']) {
      md += `- ${r._file}\n`;
    }
    md += `\n---\n\n`;
  }

  writeFileSync(OUTPUT_FILE, md, 'utf8');
  writeFileSync(PROCESSED_LOG, JSON.stringify(processed, null, 2), 'utf8');

  console.log(`\n✅ 完了: ${done}件処理`);
  console.log(`  💾 ${OUTPUT_FILE}`);
  console.log(`\n次のステップ:`);
  console.log(`  node scripts/notebooklm-research.js knowledge`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
