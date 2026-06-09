#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { basename, extname, join, relative, sep } from 'path';
import { OBSIDIAN } from './paths.js';

const toVaultPath = (path) => relative(OBSIDIAN, path).split(sep).join('/');

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const knowledgeDir = join(OBSIDIAN, 'knowledge');
const rawDir = join(OBSIDIAN, 'raw');
const outputsDir = join(OBSIDIAN, 'outputs');
const reportsDir = join(OBSIDIAN, 'reports');
const indexPath = join(knowledgeDir, 'index.md');
const knowledgeFiles = walk(knowledgeDir).filter((path) => extname(path).toLowerCase() === '.md');
const rawFiles = walk(rawDir).filter((path) => basename(path).toLowerCase() !== 'readme.md');
const outputFiles = walk(outputsDir);
const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
const issues = [];
const warnings = [];
const titles = new Map();
const knownKnowledge = new Set(
  knowledgeFiles.map((path) => toVaultPath(path).replace(/\.md$/i, '')),
);

for (const file of knowledgeFiles) {
  const relativePath = toVaultPath(file);
  const text = readFileSync(file, 'utf8');
  if (!text.trim()) issues.push(`${relativePath}: 空ファイル`);

  const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) {
    const files = titles.get(h1) ?? [];
    files.push(relativePath);
    titles.set(h1, files);
  }

  if (relativePath !== 'knowledge/index.md') {
    const target = relativePath.replace(/\.md$/i, '');
    if (!index.includes(`[[${target}`)) issues.push(`${relativePath}: knowledge/index.mdに未登録`);
  }

  const markers = [...text.matchAll(/\b(?:TODO|FIXME)\b|要検証|未検証/g)];
  if (markers.length > 0) warnings.push(`${relativePath}: 未解決マーカー ${markers.length}件`);

  for (const match of text.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
    const target = match[1].trim().replace(/\.md$/i, '');
    if (!target.startsWith('knowledge/')) continue;
    if (!knownKnowledge.has(target)) issues.push(`${relativePath}: リンク切れ [[${match[1]}]]`);
  }
}

for (const [title, files] of titles) {
  if (files.length > 1) warnings.push(`重複H1「${title}」: ${files.join(', ')}`);
}

const now = new Date();
const date = now.toISOString().slice(0, 10);
const report = `---
type: report
status: active
date: ${date}
topic: Knowledge Health
---

# Knowledge Health — ${date}

## Summary

- knowledge Markdown: ${knowledgeFiles.length}
- raw素材（README除外）: ${rawFiles.length}
- outputs: ${outputFiles.length}
- blocking issues: ${issues.length}
- warnings: ${warnings.length}

## Blocking issues

${issues.length ? issues.map((item) => `- ${item}`).join('\n') : '- なし'}

## Warnings

${warnings.length ? warnings.map((item) => `- ${item}`).join('\n') : '- なし'}

## Monthly semantic review

- [ ] 記事間の矛盾
- [ ] 新しい出典で古くなった主張
- [ ] 出典のない数値・制度・日付
- [ ] 言及されるが説明ページがない重要概念
- [ ] 良いoutputsのknowledge還元漏れ
`;

if (!process.argv.includes('--check')) {
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `knowledge-health-${date.replaceAll('-', '')}.md`);
  writeFileSync(reportPath, report, 'utf8');
  console.log(reportPath);
}
console.log(`knowledge=${knowledgeFiles.length} raw=${rawFiles.length} outputs=${outputFiles.length} issues=${issues.length} warnings=${warnings.length}`);
if (issues.length > 0) process.exitCode = 1;
