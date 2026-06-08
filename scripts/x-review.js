#!/usr/bin/env node
import { basename, join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { OBSIDIAN, ROOT } from './paths.js';
import { applyContentMemory, findAvoidedTerms } from './review/memory.js';
import { writeReview } from './review/markdown.js';
import { parseXDraft, validateXText } from './review/x.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/x-review.js <sns-drafts/日付.md> [投稿番号]');
const sourcePath = join(ROOT, arg);
const indexFilter = process.argv[3] ? Number(process.argv[3]) : null;
const reviewDir = join(OBSIDIAN, 'reviews', 'x');
mkdirSync(reviewDir, { recursive: true });

const posts = parseXDraft(arg, readFileSync(sourcePath, 'utf8'))
  .filter((post) => !indexFilter || post.index === indexFilter);
if (!posts.length) throw new Error('対象投稿が見つかりません');

for (const post of posts) {
  const date = basename(arg, '.md');
  const postId = `x-${date}-${String(post.index).padStart(3, '0')}`;
  const reviewPath = join(reviewDir, `${postId}.md`);
  if (existsSync(reviewPath) && !process.argv.includes('--refresh')) {
    console.log(`保護: ${reviewPath}`);
    continue;
  }

  const text = applyContentMemory(post.text, 'x');
  const validation = validateXText(text);
  const avoided = findAvoidedTerms(text, 'x');
  const body = `# X投稿前レビュー：${post.type}

> 投稿される本文だけを下のコードブロックで修正してください。

## 投稿本文

\`\`\`text
${text}
\`\`\`

## 自動検査

- 文字数：${validation.length}/280
- ハッシュタグ：${validation.hashtags.length}個
- エラー：${validation.errors.length ? validation.errors.join(' / ') : 'なし'}
- 警告：${validation.warnings.length ? validation.warnings.join(' / ') : 'なし'}
- 禁止表現：${avoided.length ? avoided.join(' / ') : 'なし'}

## 記憶する修正

\`\`\`text
# - x: 修正前の表現 => 修正後の表現
# - global: 全媒体の修正前 => 全媒体の修正後
# - avoid-x: 使用しない表現
\`\`\`

## 確認手順

1. 本文を修正
2. 数値・日付・制度・固有名詞を確認して \`factChecked: true\`
3. 内容確定後に \`contentApproved: true\`
4. 公開直前に \`publishApproved: true\`
`;

  writeReview(reviewPath, {
    type: 'x-review',
    source: arg,
    postId,
    postIndex: post.index,
    status: 'draft',
    factChecked: false,
    contentApproved: false,
    publishApproved: false,
    memoryApplied: false,
    published: false,
    createdAt: new Date().toISOString(),
  }, body);
  console.log(reviewPath);
}
