#!/usr/bin/env node
import { resolve } from 'path';
import { loadEnv } from './paths.js';
import { findAvoidedTerms, parseMemoryCommands } from './review/memory.js';
import { getCodeBlock, getSection, readReview, updateReviewData } from './review/markdown.js';
import { validateXText } from './review/x.js';

const reviewPath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!reviewPath) throw new Error('使い方: node scripts/publish-x.js <レビュー.md>');
const dueAtIndex = process.argv.indexOf('--due-at');
const requestedDueAt = dueAtIndex >= 0 ? process.argv[dueAtIndex + 1] : null;
if (dueAtIndex >= 0 && !requestedDueAt) {
  throw new Error('--due-at にはISO 8601形式の日時を指定してください');
}
const review = readReview(reviewPath);
const memoryCommands = parseMemoryCommands(getCodeBlock(getSection(review.body, '記憶する修正')));
if (memoryCommands.length > 0 && review.data.memoryApplied !== true) {
  throw new Error('恒久修正が未登録です。先に remember-review.js を実行してください');
}
const required = ['duplicateChecked', 'factChecked', 'contentApproved', 'publishApproved'];
const missing = required.filter((key) => review.data[key] !== true);
if (missing.length) throw new Error(`未承認: ${missing.join(', ')}`);
if (review.data.published) throw new Error('投稿済みレビューです');

const text = getCodeBlock(getSection(review.body, '投稿本文'));
const validation = validateXText(text);
const avoided = findAvoidedTerms(text, 'x');
if (validation.errors.length || avoided.length) {
  throw new Error([...validation.errors, ...avoided.map((term) => `禁止表現: ${term}`)].join('\n'));
}
const imageUrl = typeof review.data.image === 'string' && review.data.image.trim()
  ? review.data.image.trim()
  : null;

const env = loadEnv();
const query = `mutation($input: CreatePostInput!){createPost(input:$input){... on PostActionSuccess{post{id text status dueAt}} ... on MutationError{message}}}`;
const dueAt = requestedDueAt
  ? new Date(requestedDueAt)
  : new Date(Date.now() + 30 * 60 * 1000);
if (!process.argv.includes('--now') && Number.isNaN(dueAt.getTime())) {
  throw new Error('--due-at は有効なISO 8601形式で指定してください');
}
if (!process.argv.includes('--now') && dueAt.getTime() <= Date.now()) {
  throw new Error(`予約時刻は未来を指定してください: ${dueAt.toISOString()}`);
}
const input = {
  channelId: env.BUFFER_X_CHANNEL_ID,
  text,
  mode: process.argv.includes('--now') ? 'shareNow' : 'customScheduled',
  schedulingType: 'automatic',
  ...(process.argv.includes('--now') ? {} : { dueAt: dueAt.toISOString() }),
  ...(imageUrl ? { assets: { image: { url: imageUrl } } } : {}),
};
const response = await fetch('https://api.buffer.com', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.BUFFER_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { input } }),
});
const json = await response.json();
if (json.errors?.length) throw new Error(json.errors.map((error) => error.message).join('; '));
const result = json.data?.createPost;
if (result?.message) throw new Error(result.message);
updateReviewData(reviewPath, {
  published: true,
  status: result.post.status,
  bufferPostId: result.post.id,
  publishedAt: new Date().toISOString(),
});
console.log(JSON.stringify(result.post, null, 2));
