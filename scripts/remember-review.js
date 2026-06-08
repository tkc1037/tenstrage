#!/usr/bin/env node
import { resolve } from 'path';
import { rememberReviewCorrections } from './review/memory.js';

const arg = process.argv[2];
if (!arg) throw new Error('使い方: node scripts/remember-review.js <レビュー.md>');
const commands = rememberReviewCorrections(resolve(arg));
commands.forEach((command) => console.log(`✅ ${command.type}: ${command.from}${command.to ? ` => ${command.to}` : ''}`));
