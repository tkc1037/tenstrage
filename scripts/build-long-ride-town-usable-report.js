#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const VAULT = 'C:/Users/wtknt/Documents/TenstrageVault';
const REPORTS = join(VAULT, 'reports');

const rIndexPath = join(REPORTS, 'long-ride-image-index-20260620.md');
const verifiedPath = join(REPORTS, 'long-ride-verified-town-candidates-20260623.md');
const outPath = join(REPORTS, 'long-ride-usable-town-table-20260623.md');

function stripChome(address) {
  return address
    .replace(/\s+/g, '')
    .replace(/[0-9０-９]+丁目.*$/u, '')
    .replace(/([0-9０-９]+)丁目/u, '')
    .replace(/[0-9０-９]+番.*$/u, '')
    .replace(/[0-9０-９]+-[0-9０-９].*$/u, '')
    .replace(/市東深キ/g, '市東深井')
    .replace(/横浜市港南$/g, '横浜市港南区')
    .trim();
}

function parseAmount(text) {
  const n = Number(String(text).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function amountText(n) {
  return `${Math.round(n / 1000).toLocaleString()}千円`;
}

function normalizeTime(text) {
  const m = String(text).match(/(\d{1,2})時台/);
  return m ? `${Number(m[1])}時台` : String(text).split('->')[0].trim().replace(/(\d{1,2}):\d{2}.*/, '$1時台');
}

function routeParts(route) {
  const parts = route.split(/\s*->\s*/);
  return [stripChome(parts[0] ?? ''), stripChome(parts[1] ?? '')];
}

function addRow(rows, row) {
  if (!row.origin || !row.destination || row.amount < 10000) return;
  if (/未確定|除外|同一町名/.test(row.note ?? '')) return;
  const key = [row.image, row.origin, row.destination, row.amount].join('|');
  if (rows.some(r => [r.image, r.origin, r.destination, r.amount].join('|') === key)) return;
  rows.push(row);
}

function parseMarkdownTableRows(md) {
  return md
    .split(/\r?\n/)
    .filter(line => line.startsWith('| ') && !line.includes('---'))
    .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()));
}

const rows = [];

const rIndex = readFileSync(rIndexPath, 'utf8');
for (const cells of parseMarkdownTableRows(rIndex)) {
  if (cells[0] === 'ID' || !/^R\d+/.test(cells[0])) continue;
  const [id, section, time, route, amount, image, status, confidence, note] = cells;
  if (!confidence.includes('town')) continue;
  const [origin, destination] = routeParts(route);
  addRow(rows, {
    source: id,
    rank: section === '即利用可' ? '優先' : '補助',
    time: normalizeTime(time),
    origin,
    destination,
    amount: parseAmount(amount),
    image,
    note: note || status,
  });
}

const verified = readFileSync(verifiedPath, 'utf8');
let section = '';
for (const line of verified.split(/\r?\n/)) {
  if (line.startsWith('## 優先して使える')) section = '優先';
  if (line.startsWith('## 補助例として使える')) section = '補助';
  if (line.startsWith('## 除外または別枠')) section = '除外';
  if (!line.startsWith('| IMG_') || section === '除外') continue;
  const cells = line.slice(1, -1).split('|').map(cell => cell.trim());
  const [image, time, originRaw, destinationRaw, amountRaw, note] = cells;
  addRow(rows, {
    source: '目視',
    rank: section,
    time: normalizeTime(time),
    origin: stripChome(originRaw),
    destination: stripChome(destinationRaw),
    amount: parseAmount(amountRaw),
    image,
    note,
  });
}

const convertedHeicRows = [
  {
    source: 'HEIC変換',
    rank: '優先',
    time: '23時台',
    origin: '東京都港区麻布十番',
    destination: '神奈川県横浜市鶴見区北寺尾',
    amount: 16100,
    image: 'IMG_8020.jpg',
    note: 'HEIC変換後に目視確認。神奈川方面例',
  },
];

for (const row of convertedHeicRows) addRow(rows, row);

rows.sort((a, b) => b.amount - a.amount || a.image.localeCompare(b.image));

const byRank = {
  '優先': rows.filter(r => r.rank === '優先'),
  '補助': rows.filter(r => r.rank !== '優先'),
};

function table(list) {
  const lines = [
    '| 画像 | 時間帯 | 乗車地 | 降車地 | 概算 | 元 | メモ |',
    '|---|---:|---|---|---:|---|---|',
  ];
  for (const r of list) {
    lines.push(`| ${r.image} | ${r.time} | ${r.origin} | ${r.destination} | ${amountText(r.amount)} | ${r.source} | ${r.note ?? ''} |`);
  }
  return lines.join('\n');
}

const md = `# ロング営業 町名まで使えるデータ表 2026-06-23

目的: ロング営業としてXネタ・ブログネタに使える実例だけを、公開用に扱いやすい粒度へ整理する。

方針:

- 住所は丁目より前の町名・村名まで。丁目、番地、建物名、詳細住所は出さない。
- 時刻は時間帯のみ。
- 金額は千円単位。
- 画像未確定・除外判定は入れない。
- 外部APIへ画像は送っていない。既存の目視確認メモとR対応表から再構成。

件数:

- 優先して使える: ${byRank['優先'].length}件
- 補助例として使える: ${byRank['補助'].length}件
- 合計: ${rows.length}件

## 優先して使える

${table(byRank['優先'])}

## 補助例として使える

${table(byRank['補助'])}

## 除外

- IMG_7856.jpg: 中央区銀座 -> 川口市戸塚南、1時台、約17千円。既存のIMG_7860.JPGと同一内容と判断して重複除外
- 画像未確定で町名まで出せないR07/R09/R18/R19
- 既存レポートで除外・別枠扱いになっているもの
- 同一町名内、都心内短距離などロング営業素材として弱いもの
`;

writeFileSync(outPath, md, 'utf8');
console.log(outPath);
console.log(`rows=${rows.length} priority=${byRank['優先'].length} supplemental=${byRank['補助'].length}`);
