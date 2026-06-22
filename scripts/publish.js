#!/usr/bin/env node
/**
 * 記事をGitHubへ公開する。
 *
 * SNS投稿は確認ゲートを通すため、以下の専用コマンドだけを使用する:
 * - X: scripts/publish-x.js
 * - 動画: scripts/publish-video.js
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { parse, stringify } from 'yaml';
import { OBSIDIAN, ROOT } from './paths.js';
import { readReview, updateReviewData } from './review/markdown.js';

const requiredReviewFlags = [
  'duplicateChecked',
  'factChecked',
  'qualityApproved',
  'publishApproved',
];

function logDiary(entry) {
  const path = join(OBSIDIAN, 'task-diary.md');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  writeFileSync(path, `\n### ${timestamp} publish.js\n${entry}\n${existing}`, 'utf8');
}

function gitPush(dateStr, approvedFiles) {
  for (const file of approvedFiles) {
    execSync(`git add src/content/articles/${file}`, { cwd: ROOT, stdio: 'inherit' });
  }
  try {
    execSync('git diff --cached --quiet', { cwd: ROOT });
    return false;
  } catch {
    // Staged article changes exist.
  }
  execSync(`git commit -m "[${dateStr}] 記事公開"`, { cwd: ROOT, stdio: 'inherit' });
  execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
  return true;
}

function articlePath(fileName) {
  return join(ROOT, 'src', 'content', 'articles', fileName);
}

function parseArticle(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`frontmatterがありません: ${filePath}`);
  return {
    raw,
    data: parse(match[1]) ?? {},
    body: raw.slice(match[0].length),
  };
}

function writeArticle(filePath, data, body) {
  const frontmatter = stringify(data, { lineWidth: 0 }).trim();
  writeFileSync(filePath, `---\n${frontmatter}\n---\n\n${body.trimStart()}`, 'utf8');
}

function reviewPathFor(slug) {
  return join(OBSIDIAN, 'reviews', 'articles', `${slug}.md`);
}

function listCandidateArticles(slugs) {
  const articleDir = join(ROOT, 'src', 'content', 'articles');
  const files = readdirSync(articleDir).filter((file) => file.endsWith('.md'));
  if (slugs.length) {
    return slugs.map((slug) => (slug.endsWith('.md') ? slug : `${slug}.md`));
  }
  return files.filter((file) => {
    const slug = basename(file, '.md');
    const article = parseArticle(articlePath(file));
    return article.data.draft === true || existsSync(reviewPathFor(slug));
  });
}

function approveArticles(slugs, { dryRun = false } = {}) {
  const candidates = listCandidateArticles(slugs);
  const failures = [];
  const approved = [];

  for (const file of candidates) {
    const slug = basename(file, '.md');
    const filePath = articlePath(file);
    const reviewPath = reviewPathFor(slug);
    if (!existsSync(filePath)) {
      failures.push(`${file}: 記事ファイルがありません`);
      continue;
    }
    if (!existsSync(reviewPath)) {
      failures.push(`${file}: reviews/articles/${slug}.md がありません`);
      continue;
    }

    const review = readReview(reviewPath);
    const missing = requiredReviewFlags.filter((flag) => review.data[flag] !== true);
    if (missing.length) {
      failures.push(`${file}: 未承認フラグ ${missing.join(', ')}`);
      continue;
    }

    if (!dryRun) {
      const article = parseArticle(filePath);
      writeArticle(filePath, {
        ...article.data,
        draft: false,
        reviewStatus: 'published',
        factChecked: true,
      }, article.body);
      updateReviewData(reviewPath, {
        status: 'published',
        published: true,
        publishedAt: new Date().toISOString(),
      });
    }
    approved.push(file);
  }

  if (failures.length) {
    const message = [
      '- 記事公開を停止',
      ...failures.map((failure) => `  - ${failure}`),
    ].join('\n');
    if (!dryRun) logDiary(message);
    throw new Error(`記事レビュー未承認のため公開停止:\n${failures.join('\n')}`);
  }

  if (!approved.length) throw new Error('承認済みの公開対象記事がありません');
  return approved;
}

if (!process.argv.includes('--articles-only')) {
  throw new Error(
    '確認なしのSNS公開を防止しました。記事公開は --articles-only、Xは publish-x.js、動画は publish-video.js を使用してください',
  );
}

const dryRun = process.argv.includes('--dry-run');
const slugs = process.argv.filter((arg) => !arg.startsWith('--')).slice(2);
const approved = approveArticles(slugs, { dryRun });
if (dryRun) {
  console.log(`dry-run: 公開承認記事 ${approved.join(', ')}`);
  process.exit(0);
}
execSync('node scripts/check-duplicate.js --audit --public', { cwd: ROOT, stdio: 'inherit' });
execSync('node scripts/check-content-consistency.js', { cwd: ROOT, stdio: 'inherit' });
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const pushed = gitPush(today, approved);
logDiary(pushed ? `- GitHubへ記事・生成物をpush\n- 公開承認記事: ${approved.join(', ')}` : '- 公開対象の変更なし');
console.log(pushed ? '✅ GitHubへpushしました' : '変更なし');
