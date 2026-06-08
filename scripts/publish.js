#!/usr/bin/env node
/**
 * 記事をGitHubへ公開する。
 *
 * SNS投稿は確認ゲートを通すため、以下の専用コマンドだけを使用する:
 * - X: scripts/publish-x.js
 * - 動画: scripts/publish-video.js
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OBSIDIAN, ROOT } from './paths.js';

function logDiary(entry) {
  const path = join(OBSIDIAN, 'task-diary.md');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  writeFileSync(path, `\n### ${timestamp} publish.js\n${entry}\n${existing}`, 'utf8');
}

function gitPush(dateStr) {
  execSync('git add src/content/articles/', { cwd: ROOT, stdio: 'inherit' });
  const status = execSync('git status --short', { cwd: ROOT }).toString().trim();
  if (!status) return false;
  execSync(`git commit -m "[${dateStr}] 記事公開"`, { cwd: ROOT, stdio: 'inherit' });
  execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
  return true;
}

if (!process.argv.includes('--articles-only')) {
  throw new Error(
    '確認なしのSNS公開を防止しました。記事公開は --articles-only、Xは publish-x.js、動画は publish-video.js を使用してください',
  );
}

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const pushed = gitPush(today);
logDiary(pushed ? '- GitHubへ記事・生成物をpush' : '- 公開対象の変更なし');
console.log(pushed ? '✅ GitHubへpushしました' : '変更なし');
