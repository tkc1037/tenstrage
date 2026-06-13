#!/usr/bin/env node
/**
 * Buffer API経由でXスレッドを予約または即時投稿する。
 *
 * 使い方:
 *   node scripts/publish-thread.js <review.md> --dry-run
 *   node scripts/publish-thread.js <review.md> --now
 *   node scripts/publish-thread.js <review.md> --at 2026-06-12T13:00:00.000Z
 *
 * --now / --at を付けない場合は、frontmatterのscheduleを使用する。
 */

import { resolve } from 'path';
import { loadEnv } from './paths.js';
import { findAvoidedTerms } from './review/memory.js';
import { readReview, updateReviewData } from './review/markdown.js';
import { validateXText } from './review/x.js';

function parseThread(body) {
  const section =
    body.match(/## スレッド([\s\S]*?)(?=\n## [^#]|$)/)?.[1] ||
    body.match(/## 投稿本文([\s\S]*?)(?=\n## [^#]|$)/)?.[1] ||
    body;
  return [...section.matchAll(/```[^\r\n]*\r?\n([\s\S]*?)```/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function parseSchedule(value) {
  if (!value) return null;
  const normalized = String(value)
    .replace(/\s+JST$/i, '+09:00')
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})([+-]\d{2}:\d{2})$/, '$1T$2:00$3');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`不正なscheduleです: ${value}`);
  return date.toISOString();
}

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function buildInput(review, tweets, env) {
  const shareNow = process.argv.includes('--now');
  const requestedAt = getOptionValue('--at');
  const dueAt = shareNow ? null : parseSchedule(requestedAt ?? review.data.schedule);
  if (!shareNow && !dueAt) {
    throw new Error('予約日時がありません。frontmatterのschedule、--at、または--nowを指定してください');
  }

  return {
    channelId: env.BUFFER_X_CHANNEL_ID,
    text: tweets[0],
    mode: shareNow ? 'shareNow' : 'customScheduled',
    schedulingType: 'automatic',
    ...(dueAt ? { dueAt } : {}),
    ...(tweets.length > 1
      ? {
          metadata: {
            twitter: {
              thread: tweets.slice(1).map((text) => ({ text, assets: [] })),
            },
          },
        }
      : {}),
  };
}

const reviewPath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!reviewPath) {
  throw new Error('使い方: node scripts/publish-thread.js <review.md> [--dry-run|--now|--at ISO日時]');
}

const review = readReview(reviewPath);
const required = ['factChecked', 'contentApproved', 'publishApproved'];
const missing = required.filter((key) => review.data[key] !== true);
if (missing.length) throw new Error(`未承認: ${missing.join(', ')}`);
if (review.data.published) throw new Error('投稿済みです');

const tweets = parseThread(review.body);
if (tweets.length < 1) throw new Error('投稿本文が見つかりません');

for (const [index, text] of tweets.entries()) {
  const { errors } = validateXText(text);
  if (errors.length) throw new Error(`ツイート${index + 1}: ${errors.join('; ')}`);
  const avoided = findAvoidedTerms(text, 'x');
  if (avoided.length) throw new Error(`ツイート${index + 1}: 禁止表現 ${avoided.join(', ')}`);
}

const env = loadEnv();
if (!env.BUFFER_API_KEY || !env.BUFFER_X_CHANNEL_ID) {
  throw new Error('BUFFER_API_KEYまたはBUFFER_X_CHANNEL_IDが未設定です');
}

const input = buildInput(review, tweets, env);
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ reviewPath, tweetCount: tweets.length, input }, null, 2));
  process.exit(0);
}
if (input.dueAt && new Date(input.dueAt).getTime() <= Date.now()) {
  throw new Error('予約日時が過去です。--nowまたは将来日時の--atを指定してください');
}

const query = `mutation($input: CreatePostInput!){createPost(input:$input){... on PostActionSuccess{post{id text status dueAt}} ... on MutationError{message}}}`;
const response = await fetch('https://api.buffer.com', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.BUFFER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query, variables: { input } }),
});
const json = await response.json();
if (json.errors?.length) throw new Error(json.errors.map((error) => error.message).join('; '));
const result = json.data?.createPost;
if (result?.message) throw new Error(result.message);
if (!result?.post) throw new Error(`Buffer APIの応答が不正です: ${JSON.stringify(json)}`);

updateReviewData(reviewPath, {
  published: true,
  status: result.post.status,
  bufferPostId: result.post.id,
  publishedAt: new Date().toISOString(),
});

console.log(JSON.stringify(result.post, null, 2));
