#!/usr/bin/env node
import { resolve } from 'path';
import { findAvoidedTerms } from './review/memory.js';
import { getCodeBlock, getSection, readReview } from './review/markdown.js';
import { validateXText } from './review/x.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/validate-x-review.js <レビュー.md>');
const review = readReview(resolve(arg));
if (review.data.type !== 'x-review') throw new Error('Xレビューではありません');
const text = getCodeBlock(getSection(review.body, '投稿本文'));
const result = validateXText(text);
const avoided = findAvoidedTerms(text, 'x');
if (avoided.length) result.errors.push(`禁止表現: ${avoided.join(', ')}`);
console.log(JSON.stringify({ ...result, approvals: review.data }, null, 2));
if (result.errors.length) process.exit(1);
