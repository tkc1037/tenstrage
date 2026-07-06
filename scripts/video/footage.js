import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, join, relative } from 'path';
import { parse, stringify } from 'yaml';
import { IMAGE_DIR, QA_DIR } from './config.js';
import { getCodeBlock, getSection, writeReview } from '../review/markdown.js';

const SCENES = ['hook', 'info'];
// 素材ルール: 日本人・東京を検索語に含める。外国人/外国はNG。
// タクシーは会社ロゴ・JPN TAXIロゴが映りやすいので、車外全体ではなく
// メーター/車内/手元などロゴの出にくい被写体に寄せる。
const FALLBACK_QUERIES = {
  hook: 'tokyo taxi meter dashboard',
  info: 'japanese businessman office tokyo',
};

function slugifyQuery(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function sceneText(parsed, scene) {
  if (scene === 'hook') return `${parsed.hook}\n${parsed.plain}`.slice(0, 500);
  return `${parsed.lines.join('\n')}\n${parsed.plain}`.slice(0, 900);
}

export function buildSceneQueries(parsed) {
  const text = {
    hook: sceneText(parsed, 'hook'),
    info: sceneText(parsed, 'info'),
  };
  return Object.fromEntries(SCENES.map((scene) => {
    const value = text[scene];
    if (/面接|会社|求人|転職|歩合|給料|年収/.test(value)) return [scene, scene === 'hook' ? 'tokyo businessman night city street' : 'japanese businessman office tokyo'];
    if (/営業|上司|ノルマ/.test(value)) return [scene, 'japanese businessman tired office tokyo'];
    if (/タクシー|乗務|運転/.test(value)) return [scene, scene === 'hook' ? 'tokyo taxi meter dashboard' : 'japanese taxi driver hands steering wheel'];
    return [scene, FALLBACK_QUERIES[scene]];
  }));
}

async function pexelsSearch(query, env) {
  if (!env.PEXELS_API_KEY) return [];
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '5');
  const response = await fetch(url, { headers: { Authorization: env.PEXELS_API_KEY } });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.photos ?? []).slice(0, 5).map((photo, index) => ({
    n: index + 1,
    source: 'pexels',
    url: photo.url,
    author: photo.photographer,
    downloadUrl: photo.src?.large2x ?? photo.src?.large ?? photo.src?.portrait,
  }));
}

async function unsplashSearch(query, env) {
  if (!env.UNSPLASH_ACCESS_KEY) return [];
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '5');
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.results ?? []).slice(0, 5).map((photo, index) => ({
    n: index + 1,
    source: 'unsplash',
    url: photo.links?.html,
    author: photo.user?.name,
    downloadUrl: photo.urls?.regular,
    downloadLocation: photo.links?.download_location,
  }));
}

async function downloadCandidate(candidate, outputPath) {
  const response = await fetch(candidate.downloadUrl);
  if (!response.ok) throw new Error(`画像候補を保存できません: ${candidate.url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
}

function writeContactSheet(slug, manifest) {
  const outputDir = join(QA_DIR, slug, 'footage');
  const svgPath = join(outputDir, 'contact-sheet.svg');
  const cellW = 216;
  const cellH = 360;
  const labelH = 56;
  const rows = SCENES.length;
  const width = cellW * 5;
  const height = rows * (cellH + labelH);
  const cells = [];

  for (const [row, scene] of SCENES.entries()) {
    const item = manifest.footage[scene];
    cells.push(`<text x="18" y="${row * (cellH + labelH) + 34}" fill="white" font-size="26" font-family="sans-serif">${scene}: ${item.query}</text>`);
    for (const candidate of item.candidates) {
      const x = (candidate.n - 1) * cellW;
      const y = row * (cellH + labelH) + labelH;
      const href = relative(outputDir, candidate.localPath).replace(/\\/g, '/');
      cells.push(`<image href="${href}" x="${x}" y="${y}" width="${cellW}" height="${cellH}" preserveAspectRatio="xMidYMid slice"/>`);
      cells.push(`<rect x="${x + 8}" y="${y + 8}" width="44" height="44" fill="#e11d2a"/>`);
      cells.push(`<text x="${x + 21}" y="${y + 39}" fill="white" font-size="28" font-weight="800" font-family="sans-serif">${candidate.n}</text>`);
    }
  }

  writeFileSync(svgPath, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#071226"/>${cells.join('')}</svg>`, 'utf8');
  return svgPath;
}

export async function createFootageReview({ parsed, slug, review, reviewPath, env }) {
  const outputDir = join(QA_DIR, slug, 'footage');
  mkdirSync(outputDir, { recursive: true });
  const queries = buildSceneQueries(parsed);
  const manifest = { slug, generatedAt: new Date().toISOString(), footage: {} };

  for (const scene of SCENES) {
    const query = queries[scene];
    const sceneDir = join(outputDir, scene);
    mkdirSync(sceneDir, { recursive: true });
    let candidates = await pexelsSearch(query, env);
    if (candidates.length === 0) candidates = await unsplashSearch(query, env);
    if (candidates.length === 0) {
      manifest.footage[scene] = { query, source: 'fallback', chosen: 'none', candidates: [] };
      continue;
    }
    const saved = [];
    for (const candidate of candidates) {
      const localPath = join(sceneDir, `${candidate.n}.jpg`);
      await downloadCandidate(candidate, localPath);
      saved.push({ ...candidate, localPath });
    }
    manifest.footage[scene] = {
      query,
      source: saved[0]?.source,
      chosen: 0,
      candidates: saved,
    };
  }

  const contactSheet = writeContactSheet(slug, manifest);
  const manifestPath = join(outputDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, contactSheet }, null, 2), 'utf8');

  const footageYaml = stringify(manifest.footage, { lineWidth: 0 }).trim();
  const section = [
    '## 実写候補（footage）',
    '',
    `コンタクトシート: ${contactSheet}`,
    '',
    '```yaml',
    footageYaml,
    '```',
    '',
  ].join('\n');
  const body = review.body.includes('## 実写候補（footage）')
    ? review.body.replace(/## 実写候補（footage）[\s\S]*?(?=\n## |$)/, section.trimEnd())
    : `${review.body.trim()}\n\n${section}`;

  writeReview(reviewPath, {
    ...review.data,
    footageApproved: false,
  }, body);
  return { contactSheet, manifestPath };
}

export async function resolveApprovedFootage({ slug, review, env }) {
  const section = getSection(review.body, '実写候補（footage）');
  if (!section && review.data.footageApproved === undefined) return undefined;
  if (review.data.footageApproved !== true) {
    throw new Error('実写背景が未承認です。reviews/video の footageApproved と chosen を確認してください');
  }

  const footage = parse(getCodeBlock(section)) ?? {};
  const sceneImages = {};
  const publicDir = join(IMAGE_DIR, 'video', slug);
  mkdirSync(publicDir, { recursive: true });

  for (const scene of SCENES) {
    const item = footage[scene];
    if (!item || item.chosen === 'none') continue;
    if (!item.chosen || item.chosen === 0) {
      throw new Error(`実写背景の採用番号が未決です: ${scene}`);
    }
    const candidate = item.candidates?.find((entry) => Number(entry.n) === Number(item.chosen));
    if (!candidate) throw new Error(`実写背景の採用候補が見つかりません: ${scene}`);
    if (candidate.source === 'unsplash' && candidate.downloadLocation && env.UNSPLASH_ACCESS_KEY) {
      const url = new URL(candidate.downloadLocation);
      url.searchParams.set('client_id', env.UNSPLASH_ACCESS_KEY);
      await fetch(url);
    }
    const outputPath = join(publicDir, `${scene}.jpg`);
    if (!existsSync(candidate.localPath)) throw new Error(`実写候補ファイルがありません: ${candidate.localPath}`);
    copyFileSync(candidate.localPath, outputPath);
    sceneImages[scene] = `images/video/${slug}/${basename(outputPath)}`;
  }

  return Object.keys(sceneImages).length > 0 ? sceneImages : undefined;
}
