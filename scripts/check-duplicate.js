import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ROOT, OBSIDIAN } from './paths.js';

const ARTICLES_DIR = join(ROOT, 'src/content/articles');
const TOPIC_REGISTRY = join(OBSIDIAN, 'rules/topic-registry.md');
const ARTICLE_IDEAS = join(OBSIDIAN, 'reports/article-ideas.md');

function extractTitle(content) {
  const m = content.match(/^title:\s*"?(.+?)"?\s*$/m);
  return m ? m[1] : null;
}

function extractTags(content) {
  const m = content.match(/^tags:\s*\[(.+)\]\s*$/m);
  if (!m) return [];
  return m[1].split(',').map(t => t.trim().replace(/^"|"$/g, ''));
}

function extractDescription(content) {
  const m = content.match(/^description:\s*"?(.+?)"?\s*$/m);
  return m ? m[1] : '';
}

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\s*/, '');
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
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
  { pattern: /事故負担|負担金|事故リスク/gi, canonical: '事故負担' },
  { pattern: /廃業|倒産|休廃業/gi, canonical: '廃業' },
  { pattern: /副業|副収入|ダブルワーク|Wワーク/gi, canonical: '副業' },
];

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

function registryText() {
  return existsSync(TOPIC_REGISTRY) ? readFileSync(TOPIC_REGISTRY, 'utf8') : '';
}

function extractRegistryCanonicalSlugs(text) {
  const section = text.match(/## 記事台帳（canonical）[\s\S]*?(?=\n---|\n## |$)/)?.[0] ?? '';
  return new Set(
    [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)]
      .map((match) => match[1])
      .filter((slug) => slug !== 'slug')
  );
}

function loadArticles() {
  const files = readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const content = readFileSync(join(ARTICLES_DIR, file), 'utf8');
    const title = extractTitle(content);
    const tags = extractTags(content);
    const isDraft = !/^draft:\s*false/m.test(content);
    const body = stripFrontmatter(content).replace(/## 関連記事[\s\S]*$/m, '');
    const description = extractDescription(content);
    const topicText = `${title ?? ''} ${description} ${tags.join(' ')}`;
    return {
      file,
      slug: file.replace(/\.md$/, ''),
      title,
      tags,
      isDraft,
      keywords: extractKeywords(topicText),
      titleShingles: shingles(title ?? '', 3, 300),
      bodyShingles: shingles(body, 5, 2600),
    };
  }).filter(a => a.title);
}

function findDuplicatesForProposal(proposedTitle, articles) {
  const proposedKeywords = extractKeywords(proposedTitle);
  const proposedTitleShingles = shingles(proposedTitle, 3, 300);
  const duplicates = [];
  for (const a of articles) {
    const keywordScore = overlapScore(proposedKeywords, a.keywords);
    const titleScore = jaccard(proposedTitleShingles, a.titleShingles);
    if (a.title === proposedTitle) duplicates.push({ ...a, reason: '完全一致', score: 1 });
    else if (keywordScore >= 0.4) duplicates.push({ ...a, reason: `キーワード重複 ${Math.round(keywordScore * 100)}%`, score: keywordScore });
    else if (titleScore >= 0.25) duplicates.push({ ...a, reason: `タイトル類似 ${Math.round(titleScore * 100)}%`, score: titleScore });
  }
  return duplicates.sort((a, b) => b.score - a.score);
}

function audit(articles, publicOnly = false) {
  const target = publicOnly ? articles.filter(a => !a.isDraft) : articles;
  const pairs = [];
  for (let i = 0; i < target.length; i++) {
    for (let j = i + 1; j < target.length; j++) {
      const a = target[i], b = target[j];
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

function auditRegistryCoverage(articles) {
  const canonicalSlugs = extractRegistryCanonicalSlugs(registryText());
  const publicSlugs = new Set(articles.filter((article) => !article.isDraft).map((article) => article.slug));
  const missingInRegistry = [...publicSlugs].filter((slug) => !canonicalSlugs.has(slug)).sort();
  const missingInPublic = [...canonicalSlugs].filter((slug) => !publicSlugs.has(slug)).sort();
  return { missingInRegistry, missingInPublic };
}

function parseMarkdownRow(line) {
  if (!line.trim().startsWith('|')) return null;
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function loadArticleIdeas() {
  if (!existsSync(ARTICLE_IDEAS)) {
    throw new Error(`reports/article-ideas.md が見つかりません: ${ARTICLE_IDEAS}`);
  }
  const rows = [];
  let inCandidates = false;
  for (const line of readFileSync(ARTICLE_IDEAS, 'utf8').split('\n')) {
    if (/^##\s+候補/.test(line)) {
      inCandidates = true;
      continue;
    }
    if (inCandidates && /^##\s+/.test(line)) break;
    if (!inCandidates) continue;

    const cells = parseMarkdownRow(line);
    if (!cells || cells.length < 10) continue;
    if (cells[0] === '日付' || /^-+$/.test(cells[0])) continue;

    rows.push({
      date: cells[0],
      tier: cells[1],
      priority: cells[2],
      theme: cells[3],
      keywords: cells[4],
      source: cells[5],
      gap: cells[6],
      experience: cells[7],
      verification: cells[8],
      status: cells[9],
    });
  }
  return rows;
}

function rank(value, order) {
  const index = order.indexOf(value);
  return index === -1 ? 99 : index;
}

function sortArticleIdeas(a, b) {
  return (
    rank(a.tier, ['Tier1', 'Tier2', 'Tier3']) - rank(b.tier, ['Tier1', 'Tier2', 'Tier3']) ||
    rank(a.experience, ['高', '中', '低']) - rank(b.experience, ['高', '中', '低']) ||
    rank(a.priority, ['高', '中', '低']) - rank(b.priority, ['高', '中', '低']) ||
    a.theme.localeCompare(b.theme, 'ja')
  );
}

function filterArticleIdeas(articles) {
  const ideas = loadArticleIdeas()
    .filter((row) => row.status === '未着手')
    .sort(sortArticleIdeas);
  const available = [];
  const covered = [];

  for (const row of ideas) {
    const duplicates = findDuplicatesForProposal(`${row.theme} ${row.keywords}`, articles);
    if (duplicates.length) covered.push({ ...row, matchedArticle: duplicates[0] });
    else available.push(row);
  }

  return { ideas, available, covered };
}

const articles = loadArticles();
const args = process.argv.slice(2);
const arg = args.find(a => !a.startsWith('--'));
const publicOnly = args.includes('--public');

if (args.includes('--audit')) {
  const pairs = audit(articles, publicOnly);
  const registryCoverage = publicOnly
    ? auditRegistryCoverage(articles)
    : { missingInRegistry: [], missingInPublic: [] };
  console.log(`\n🔎 重複監査: ${publicOnly ? '公開記事のみ' : '全記事'} / ${pairs.length}件\n`);
  for (const p of pairs) {
    console.log(`❌ ${p.a.file}  <->  ${p.b.file}`);
    console.log(`   ${p.a.title}`);
    console.log(`   ${p.b.title}`);
    console.log(`   score=${p.score.toFixed(2)} keyword=${p.keywordScore.toFixed(2)} title=${p.titleScore.toFixed(2)} body=${p.bodyScore.toFixed(2)}\n`);
  }
  if (publicOnly) {
    if (registryCoverage.missingInRegistry.length > 0) {
      console.log('❌ canonical台帳に未記載の公開記事:');
      for (const slug of registryCoverage.missingInRegistry) console.log(`   - ${slug}`);
      console.log('');
    }
    if (registryCoverage.missingInPublic.length > 0) {
      console.log('❌ canonical台帳にあるが公開記事ではないslug:');
      for (const slug of registryCoverage.missingInPublic) console.log(`   - ${slug}`);
      console.log('');
    }
  }
  const registryErrorCount = registryCoverage.missingInRegistry.length + registryCoverage.missingInPublic.length;
  process.exit(pairs.length > 0 || registryErrorCount > 0 ? 1 : 0);
}

if (args.includes('--ideas')) {
  try {
    const { ideas, available, covered } = filterArticleIdeas(articles);
    console.log(`\n📊 article-ideasフィルタ結果（未着手 ${ideas.length}件）\n`);
    if (available.length) {
      console.log(`✅ 選定可能（${available.length}件）:\n`);
      for (const row of available) {
        console.log(`  [${row.tier} / 体験:${row.experience} / 優先:${row.priority}] ${row.theme}`);
        console.log(`    KW: ${row.keywords}`);
      }
    } else {
      console.log('✅ 選定可能: 0件');
    }

    if (covered.length) {
      console.log(`\n❌ カバー済み・重複候補（${covered.length}件 — これらは選ばない）:\n`);
      for (const row of covered) {
        console.log(`  [${row.tier} / 体験:${row.experience} / 優先:${row.priority}] ${row.theme}`);
        console.log(`    → 既存: ${row.matchedArticle.file}（${row.matchedArticle.reason}）`);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (arg === '--suggest') {
  const trendsPath = join(ROOT, 'feedback/trends.md');
  if (!existsSync(trendsPath)) {
    console.error('feedback/trends.md が見つかりません');
    process.exit(1);
  }
  const trendsContent = readFileSync(trendsPath, 'utf8');
  const themeRows = [];
  for (const line of trendsContent.split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(高|中|低)\s*\|/);
    if (m && !m[1].startsWith('テーマ') && !m[1].startsWith('--')) themeRows.push({ theme: m[1].trim(), priority: m[2] });
  }
  const available = [], covered = [];
  for (const row of themeRows) {
    const duplicates = findDuplicatesForProposal(row.theme, articles);
    if (duplicates.length) covered.push({ ...row, matchedArticle: duplicates[0] });
    else available.push(row);
  }
  console.log(`\n📊 テーマ候補フィルタ結果（trends.md → ${themeRows.length}件）\n`);
  if (available.length) {
    console.log(`✅ 執筆可能（${available.length}件）:\n`);
    for (const t of available) console.log(`  [${t.priority}] ${t.theme}`);
  }
  if (covered.length) {
    console.log(`\n❌ カバー済み（${covered.length}件 — これらは選ばない）:\n`);
    for (const t of covered) {
      console.log(`  [${t.priority}] ${t.theme}`);
      console.log(`    → 既存: ${t.matchedArticle.file}`);
    }
  }
  process.exit(0);
}

if (!arg) {
  console.log(`\n📋 既存記事一覧（${articles.length}本）\n`);
  console.log('Status | Slug | Title');
  console.log('-------|------|------');
  for (const a of articles.sort((x, y) => x.file.localeCompare(y.file))) {
    const status = a.isDraft ? 'DRAFT' : 'PUBLIC';
    console.log(`${status.padEnd(6)} | ${a.slug.padEnd(45)} | ${a.title}`);
  }
  console.log(`\n合計: ${articles.length}本（公開: ${articles.filter(a => !a.isDraft).length}, draft: ${articles.filter(a => a.isDraft).length}）`);
  console.log('重複監査: node scripts/check-duplicate.js --audit --public');
  process.exit(0);
}

console.log(`\n🔍 重複チェック: "${arg}"\n`);
const duplicates = findDuplicatesForProposal(arg, articles);
if (duplicates.length) {
  console.log('❌ 重複の可能性あり:\n');
  for (const d of duplicates) {
    console.log(`  [${d.reason}] ${d.file}`);
    console.log(`    既存: ${d.title}`);
    console.log(`    提案: ${arg}\n`);
  }
  console.log('→ 新規記事を生成せず、既存記事の改善・リライトを検討してください。');
  process.exit(1);
}
console.log('✅ 重複なし — 記事を生成できます。');
process.exit(0);


