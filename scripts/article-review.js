#!/usr/bin/env node
import { basename, join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import { OBSIDIAN, ROOT } from './paths.js';
import { writeReview } from './review/markdown.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/article-review.js <src/content/articles/slug.md>');

const sourcePath = join(ROOT, arg);
if (!existsSync(sourcePath)) throw new Error(`記事が見つかりません: ${arg}`);

const slug = basename(arg, '.md');
const reviewDir = join(OBSIDIAN, 'reviews', 'articles');
const reviewPath = join(reviewDir, `${slug}.md`);
mkdirSync(reviewDir, { recursive: true });

if (existsSync(reviewPath) && !process.argv.includes('--refresh')) {
  console.log(`保護: ${reviewPath}`);
  process.exit(0);
}

const raw = readFileSync(sourcePath, 'utf8');
const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
const data = frontmatter ? parse(frontmatter[1]) ?? {} : {};

const body = `# 記事公開前レビュー：${data.title ?? slug}

> 公開する前に、本文・リンク・事実関係・重複を確認し、下のfrontmatterフラグをtrueにしてください。

## 対象記事

- source: \`${arg}\`
- slug: \`${slug}\`
- title: ${data.title ?? ''}
- draft: ${data.draft === false ? 'false' : 'true'}

## 確認項目

1. \`duplicateChecked: true\` — 既存記事との重複監査と意図重複の目視確認が済んでいる
2. \`factChecked: true\` — 数値・日付・制度・固有名詞・リンクを確認済み
3. \`qualityApproved: true\` — 読者価値、構成、アフィリエイトリンク、表現品質を確認済み
4. \`publishApproved: true\` — 公開直前の最終承認済み

## Claudeレビュー

- 事故再発防止:
- 承認ゲート:
- 重複ゼロ:
- 一次情報優先:

## ユーザー確認メモ

- 修正指示:
- 公開可否:
`;

writeReview(reviewPath, {
  type: 'article-review',
  source: arg,
  slug,
  status: 'draft',
  duplicateChecked: false,
  factChecked: false,
  qualityApproved: false,
  publishApproved: false,
  published: false,
  createdAt: new Date().toISOString(),
}, body);

console.log(reviewPath);
