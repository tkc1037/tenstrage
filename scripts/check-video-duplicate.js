#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { OBSIDIAN, ROOT } from './paths.js';

const VIDEO_SCRIPTS_DIR = join(ROOT, 'video-scripts');
const VIDEO_REVIEWS_DIR = join(OBSIDIAN, 'reviews/video');

const TOPIC_PATTERNS = [
  { pattern: /求人サイト|転職サイト|求人媒体|求人検索|転職支援|求人サービス/gi, canonical: '求人サイト比較' },
  { pattern: /入社祝い金|祝い金|支度金|返金条件|signing.?bonus/gi, canonical: '祝い金' },
  { pattern: /GO\s*Crew|GOクルー|ゴークルー|go\s*crew/gi, canonical: 'gocrew' },
  { pattern: /GOアプリ|配車アプリ|S\.RIDE|Uber|DiDi|連続配車|サンキューチケット/gi, canonical: '配車アプリ' },
  { pattern: /年収800万|800万円|年収800/gi, canonical: '年収800万' },
  { pattern: /年収502万|502万円|平均年収/gi, canonical: '年収502万' },
  { pattern: /年収600万|600万円/gi, canonical: '年収600万' },
  { pattern: /収入シミュレーション|年収シミュレーション|月収シミュレーション/gi, canonical: '収入シミュレーション' },
  { pattern: /手取り|手取り計算|控除/gi, canonical: '手取り' },
  { pattern: /歩合|歩合率|歩合制|歩合給/gi, canonical: '歩合' },
  { pattern: /隔日勤務|夜日勤|昼日勤|勤務形態|シフト/gi, canonical: '勤務形態' },
  { pattern: /二種免許|2種免許|免許取得|資格取得/gi, canonical: '二種免許' },
  { pattern: /会社の選び方|会社選び|企業選び|会社比較|企業比較|生き残る企業/gi, canonical: '会社選び' },
  { pattern: /求人倍率|求人市場|売り手市場|人手不足/gi, canonical: '求人市場' },
  { pattern: /エリアランキング|稼げるエリア|羽田|新宿|渋谷/gi, canonical: 'エリア' },
  { pattern: /運賃改定|運賃値上げ|初乗り|改定率/gi, canonical: '運賃改定' },
  { pattern: /40代|50代|中高年|ミドル/gi, canonical: '中高年転職' },
  { pattern: /転職ロードマップ|転職ステップ|転職の流れ/gi, canonical: 'ロードマップ' },
  { pattern: /JPN\s*TAXI|ジャパンタクシー|車両選び/gi, canonical: 'jpntaxi' },
  { pattern: /確定申告|節税|税金|税金対策/gi, canonical: '税金' },
  { pattern: /外国人|インバウンド|観光客/gi, canonical: 'インバウンド' },
  { pattern: /事故負担|事故の負担|負担金|事故リスク|無事故手当/gi, canonical: '事故負担' },
  { pattern: /廃業|倒産|休廃業/gi, canonical: '廃業' },
  { pattern: /副業|副収入|ダブルワーク|Wワーク/gi, canonical: '副業' },
];

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: content };
  const data = YAML.parse(match[1]) ?? {};
  return { data, body: content.slice(match[0].length) };
}

function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_#>[\]()]/g, ' ')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function shingles(text, size = 5, limit = 1800) {
  const normalized = normalizeText(text).slice(0, limit);
  const set = new Set();
  for (let i = 0; i <= normalized.length - size; i++) set.add(normalized.slice(i, i + size));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function extractKeywords(text) {
  const keywords = new Set();
  for (const { pattern, canonical } of TOPIC_PATTERNS) {
    if (pattern.test(text)) keywords.add(canonical);
    pattern.lastIndex = 0;
  }
  return keywords;
}

function overlapScore(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const k of a) for (const k2 of b) if (k === k2 || k.includes(k2) || k2.includes(k)) overlap++;
  return overlap / Math.min(a.size, b.size);
}

function extractSection(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return body.match(new RegExp(`^###\\s+${escaped}\\s*$([\\s\\S]*?)(?=^###\\s+|^##\\s+|$)`, 'm'))?.[1]?.trim() ?? '';
}

function extractDisplaySettings(reviewContent) {
  const block = reviewContent.match(/##\s+表示設定[\s\S]*?```ya?ml\r?\n([\s\S]*?)```/);
  if (!block) return {};
  try {
    return YAML.parse(block[1]) ?? {};
  } catch {
    return {};
  }
}

function reviewData(slug) {
  const path = join(VIDEO_REVIEWS_DIR, `${slug}.md`);
  if (!existsSync(path)) return { status: 'script-only', text: '' };

  const { data, body } = parseFrontmatter(readFileSync(path, 'utf8'));
  const settings = extractDisplaySettings(body);
  const lines = Array.isArray(settings.lines) ? settings.lines.join(' ') : '';
  return {
    status: data.status ?? 'review',
    text: [settings.title, settings.hook, lines].filter(Boolean).join(' '),
  };
}

function loadVideos() {
  return readdirSync(VIDEO_SCRIPTS_DIR)
    .filter((file) => file.endsWith('.md') && file !== '_template.md')
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      const { data, body } = parseFrontmatter(readFileSync(join(VIDEO_SCRIPTS_DIR, file), 'utf8'));
      const review = reviewData(slug);
      const title = data.title ?? slug;
      const hook = data.hook ?? '';
      const sectionText = [
        extractSection(body, 'フック'),
        extractSection(body, '本編'),
        extractSection(body, 'CTA'),
      ].join(' ');
      const topicText = [title, hook, sectionText, review.text].filter(Boolean).join(' ');
      return {
        file,
        slug,
        title,
        status: review.status,
        keywords: extractKeywords(topicText),
        titleShingles: shingles(title, 3, 300),
        bodyShingles: shingles(topicText, 5, 2600),
      };
    })
    .filter((video) => video.title);
}

function findDuplicatesForProposal(proposedTitle, videos) {
  const proposedKeywords = extractKeywords(proposedTitle);
  const proposedTitleShingles = shingles(proposedTitle, 3, 300);
  const duplicates = [];
  for (const video of videos) {
    const keywordScore = overlapScore(proposedKeywords, video.keywords);
    const titleScore = jaccard(proposedTitleShingles, video.titleShingles);
    if (video.title === proposedTitle) duplicates.push({ ...video, reason: '完全一致', score: 1 });
    else if (keywordScore >= 0.4) duplicates.push({ ...video, reason: `キーワード重複 ${Math.round(keywordScore * 100)}%`, score: keywordScore });
    else if (titleScore >= 0.25) duplicates.push({ ...video, reason: `タイトル類似 ${Math.round(titleScore * 100)}%`, score: titleScore });
  }
  return duplicates.sort((a, b) => b.score - a.score);
}

function audit(videos) {
  const pairs = [];
  for (let i = 0; i < videos.length; i++) {
    for (let j = i + 1; j < videos.length; j++) {
      const a = videos[i], b = videos[j];
      const keywordScore = overlapScore(a.keywords, b.keywords);
      const titleScore = jaccard(a.titleShingles, b.titleShingles);
      const bodyScore = jaccard(a.bodyShingles, b.bodyShingles);
      const score = Math.max(keywordScore, titleScore, bodyScore);
      const strongKeywordWithSimilarity = keywordScore >= 0.6 && (titleScore >= 0.12 || bodyScore >= 0.12);
      if (titleScore >= 0.25 || bodyScore >= 0.30 || strongKeywordWithSimilarity) {
        pairs.push({ a, b, score, keywordScore, titleScore, bodyScore });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

const videos = loadVideos();
const args = process.argv.slice(2);
const proposedTitle = args.find((arg) => !arg.startsWith('--'));

if (args.includes('--audit')) {
  const pairs = audit(videos);
  console.log(`\n🔎 動画重複監査: ${pairs.length}件\n`);
  for (const pair of pairs) {
    console.log(`❌ ${pair.a.file}  <->  ${pair.b.file}`);
    console.log(`   ${pair.a.title}`);
    console.log(`   ${pair.b.title}`);
    console.log(`   score=${pair.score.toFixed(2)} keyword=${pair.keywordScore.toFixed(2)} title=${pair.titleScore.toFixed(2)} body=${pair.bodyScore.toFixed(2)}\n`);
  }
  process.exit(pairs.length > 0 ? 1 : 0);
}

if (!proposedTitle) {
  console.log(`\n📋 既存動画一覧（${videos.length}本）\n`);
  console.log('Status | Slug | Title');
  console.log('-------|------|------');
  for (const video of videos.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`${String(video.status).padEnd(10)} | ${video.slug.padEnd(36)} | ${video.title}`);
  }
  console.log('\n重複チェック: node scripts/check-video-duplicate.js "提案タイトル"');
  console.log('重複監査: node scripts/check-video-duplicate.js --audit');
  process.exit(0);
}

console.log(`\n🔍 動画重複チェック: "${proposedTitle}"\n`);
const duplicates = findDuplicatesForProposal(proposedTitle, videos);
if (duplicates.length) {
  console.log('❌ 重複の可能性あり:\n');
  for (const duplicate of duplicates) {
    console.log(`  [${duplicate.reason}] ${duplicate.file}`);
    console.log(`    既存: ${duplicate.title}`);
    console.log(`    提案: ${proposedTitle}\n`);
  }
  console.log('→ 新規台本を生成せず、別テーマ・別切り口にしてください。');
  process.exit(1);
}

console.log('✅ 重複なし — 動画台本案として検討できます。');
process.exit(0);
