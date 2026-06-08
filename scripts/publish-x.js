#!/usr/bin/env node
import { resolve } from 'path';
import { loadEnv } from './paths.js';
import { findAvoidedTerms, parseMemoryCommands } from './review/memory.js';
import { getCodeBlock, getSection, readReview, updateReviewData } from './review/markdown.js';
import { validateXText } from './review/x.js';

const reviewPath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!reviewPath) throw new Error('使い方: node scripts/publish-x.js <レビュー.md>');
const review = readReview(reviewPath);
const memoryCommands = parseMemoryCommands(getCodeBlock(getSection(review.body, '記憶する修正')));
if (memoryCommands.length > 0 && review.data.memoryApplied !== true) {
  throw new Error('恒久修正が未登録です。先に remember-review.js を実行してください');
}
const required = ['factChecked', 'contentApproved', 'publishApproved'];
const missing = required.filter((key) => review.data[key] !== true);
if (missing.length) throw new Error(`未承認: ${missing.join(', ')}`);
if (review.data.published) throw new Error('投稿済みレビューです');

const text = getCodeBlock(getSection(review.body, '投稿本文'));
const validation = validateXText(text);
const avoided = findAvoidedTerms(text, 'x');
if (validation.errors.length || avoided.length) {
  throw new Error([...validation.errors, ...avoided.map((term) => `禁止表現: ${term}`)].join('\n'));
}

const env = loadEnv();
const query = `mutation($input: CreatePostInput!){createPost(input:$input){... on PostActionSuccess{post{id text status dueAt}} ... on MutationError{message}}}`;
const input = {
  channelId: env.BUFFER_X_CHANNEL_ID,
  text,
  mode: process.argv.includes('--now') ? 'shareNow' : 'customScheduled',
  schedulingType: 'automatic',
  ...(process.argv.includes('--now') ? {} : { dueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }),
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
