/**
 * check-duplicate.js — 記事重複チェッカー
 *
 * 使い方:
 *   node scripts/check-duplicate.js                  # 既存記事一覧を表示
 *   node scripts/check-duplicate.js --suggest         # trends.mdから未カバーテーマを抽出
 *   node scripts/check-duplicate.js "提案タイトル"    # 重複チェック
 *
 * 記事生成前に必ず実行する。exit code 1 = 重複あり。
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ROOT } from './paths.js';

const ARTICLES_DIR = join(ROOT, 'src/content/articles');

/** frontmatterからtitleを抽出 */
function extractTitle(content) {
  const m = content.match(/^title:\s*"?(.+?)"?\s*$/m);
  return m ? m[1] : null;
}

/** frontmatterからtagsを抽出 */
function extractTags(content) {
  const m = content.match(/^tags:\s*\[(.+)\]\s*$/m);
  if (!m) return [];
  return m[1].split(',').map(t => t.trim().replace(/^"|"$/g, ''));
}

/**
 * パターン → canonical キーワードへの正規化マップ
 * 同じトピックの表記ゆれを1つの正規形に統一する
 */
const TOPIC_PATTERNS = [
  { pattern: /入社祝い金|祝い金|signing.?bonus/gi, canonical: '祝い金' },
  { pattern: /GO\s*Crew|GOクルー|ゴークルー|go\s*crew/gi, canonical: 'gocrew' },
  { pattern: /GOアプリ|配車アプリ|GO\s*アプリ/gi, canonical: '配車アプリ' },
  { pattern: /年収800万|800万円|年収800/gi, canonical: '年収800万' },
  { pattern: /年収502万|502万円|平均年収/gi, canonical: '年収502万' },
  { pattern: /年収600万|600万円/gi, canonical: '年収600万' },
  { pattern: /年収1000万|1000万円/gi, canonical: '年収1000万' },
  { pattern: /歩合|歩合率|歩合制|歩合給/gi, canonical: '歩合' },
  { pattern: /隔日勤務|夜日勤|昼日勤|勤務形態|シフト/gi, canonical: '勤務形態' },
  { pattern: /二種免許|免許取得|免許/gi, canonical: '二種免許' },
  { pattern: /会社の選び方|会社選び|企業選び|会社比較/gi, canonical: '会社選び' },
  { pattern: /エリアランキング|稼げるエリア|エリア別/gi, canonical: 'エリア' },
  { pattern: /梅雨|夏の稼ぎ|季節需要/gi, canonical: '季節需要' },
  { pattern: /運賃改定|運賃値上げ|運賃/gi, canonical: '運賃改定' },
  { pattern: /40代|50代|中高年|ミドル/gi, canonical: '中高年転職' },
  { pattern: /転職ロードマップ|転職ステップ|転職の流れ/gi, canonical: 'ロードマップ' },
  { pattern: /手取り|手取り計算|手取り額/gi, canonical: '手取り' },
  { pattern: /JPN\s*TAXI|ジャパンタクシー/gi, canonical: 'jpntaxi' },
  { pattern: /確定申告|節税|税金|税金対策/gi, canonical: '税金' },
  { pattern: /外国人|インバウンド|観光客/gi, canonical: 'インバウンド' },
  { pattern: /事故負担|負担金|事故リスク/gi, canonical: '事故負担' },
  { pattern: /廃業|倒産|生き残り/gi, canonical: '廃業' },
  { pattern: /副業|副収入|ダブルワーク/gi, canonical: '副業' },
];

/** タイトルからcanonicalキーワードを抽出 */
function extractKeywords(title) {
  const keywords = new Set();
  for (const { pattern, canonical } of TOPIC_PATTERNS) {
    if (pattern.test(title)) {
      keywords.add(canonical);
    }
    pattern.lastIndex = 0; // reset global regex
  }
  return keywords;
}

/** 2つのセットの重複率を計算 */
function overlapScore(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const k of a) {
    for (const k2 of b) {
      if (k === k2 || k.includes(k2) || k2.includes(k)) overlap++;
    }
  }
  return overlap / Math.min(a.size, b.size);
}

// --- Main ---

const files = readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
const articles = [];

for (const file of files) {
  const content = readFileSync(join(ARTICLES_DIR, file), 'utf8');
  const title = extractTitle(content);
  const tags = extractTags(content);
  const isDraft = /^draft:\s*true/m.test(content);
  if (title) {
    articles.push({ file, title, tags, isDraft, keywords: extractKeywords(title) });
  }
}

const arg = process.argv[2];

// --suggest モード: trends.mdから未カバーのテーマだけ抽出
if (arg === '--suggest') {
  const trendsPath = join(ROOT, 'feedback/trends.md');
  if (!existsSync(trendsPath)) {
    console.error('feedback/trends.md が見つかりません');
    process.exit(1);
  }
  const trendsContent = readFileSync(trendsPath, 'utf8');

  // テーブル行からテーマ列を抽出（| テーマ | 優先度 | ... のパターン）
  const themeRows = [];
  for (const line of trendsContent.split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(高|中|低)\s*\|/);
    if (m && !m[1].startsWith('テーマ') && !m[1].startsWith('--')) {
      themeRows.push({ theme: m[1].trim(), priority: m[2] });
    }
  }

  const available = [];
  const covered = [];

  for (const row of themeRows) {
    const kw = extractKeywords(row.theme);
    let isDuplicate = false;
    let matchedArticle = null;

    for (const a of articles) {
      const score = overlapScore(kw, a.keywords);
      if (score >= 0.5 || a.title === row.theme) {
        isDuplicate = true;
        matchedArticle = a;
        break;
      }
    }

    if (isDuplicate) {
      covered.push({ ...row, matchedArticle });
    } else {
      available.push(row);
    }
  }

  console.log(`\n📊 テーマ候補フィルタ結果（trends.md → ${themeRows.length}件）\n`);

  if (available.length > 0) {
    console.log(`✅ 執筆可能（${available.length}件）:\n`);
    for (const t of available) {
      console.log(`  [${t.priority}] ${t.theme}`);
    }
  }

  if (covered.length > 0) {
    console.log(`\n❌ カバー済み（${covered.length}件 — これらは選ばない）:\n`);
    for (const t of covered) {
      console.log(`  [${t.priority}] ${t.theme}`);
      console.log(`    → 既存: ${t.matchedArticle.file}`);
    }
  }

  console.log(`\n結果: ${available.length}件が執筆可能 / ${covered.length}件はカバー済み`);
  process.exit(0);
}

const proposedTitle = arg;

if (!proposedTitle) {
  // 引数なし → 既存記事一覧を出力
  console.log(`\n📋 既存記事一覧（${articles.length}本）\n`);
  console.log('Status | Slug | Title');
  console.log('-------|------|------');
  for (const a of articles.sort((x, y) => x.file.localeCompare(y.file))) {
    const status = a.isDraft ? 'DRAFT' : 'PUBLIC';
    console.log(`${status.padEnd(6)} | ${a.file.replace('.md', '').padEnd(45)} | ${a.title}`);
  }
  console.log(`\n合計: ${articles.length}本（公開: ${articles.filter(a => !a.isDraft).length}, draft: ${articles.filter(a => a.isDraft).length}）`);
  process.exit(0);
}

// 引数あり → 重複チェック
console.log(`\n🔍 重複チェック: "${proposedTitle}"\n`);

const proposedKeywords = extractKeywords(proposedTitle);
const duplicates = [];

for (const a of articles) {
  const score = overlapScore(proposedKeywords, a.keywords);

  // タイトル完全一致
  if (a.title === proposedTitle) {
    duplicates.push({ ...a, reason: '完全一致', score: 1.0 });
    continue;
  }

  // キーワード高重複
  if (score >= 0.5) {
    duplicates.push({ ...a, reason: `キーワード重複 ${Math.round(score * 100)}%`, score });
  }
}

if (duplicates.length > 0) {
  console.log('❌ 重複の可能性あり:\n');
  for (const d of duplicates.sort((a, b) => b.score - a.score)) {
    console.log(`  [${d.reason}] ${d.file}`);
    console.log(`    既存: ${d.title}`);
    console.log(`    提案: ${proposedTitle}\n`);
  }
  console.log('→ 新規記事を生成せず、既存記事の改善を検討してください。');
  process.exit(1);
} else {
  console.log('✅ 重複なし — 記事を生成できます。');
  console.log(`  キーワード: [${[...proposedKeywords].join(', ')}]`);
  process.exit(0);
}
