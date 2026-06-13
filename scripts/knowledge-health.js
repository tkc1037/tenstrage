#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { basename, extname, join, relative, sep } from 'path';
import { OBSIDIAN } from './paths.js';

const ORPHAN_AGE_DAYS = 30;
const STALE_LOW_LINK_AGE_DAYS = 90;
const toVaultPath = (path) => relative(OBSIDIAN, path).split(sep).join('/');
const normalizeTarget = (target) => target.trim().replace(/\.md$/i, '');

function wikilinks(text) {
  return [...text.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
    .map((match) => normalizeTarget(match[1]));
}

function frontmatterValue(text, key) {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!frontmatter) return null;
  return frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1]?.replace(/^["']|["']$/g, '') ?? null;
}

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
const now = new Date();
const issues = [];
const warnings = [];
const titles = new Map();
const orphanCandidates = [];
const staleLowLinkCandidates = [];
const knownKnowledge = new Set(
  knowledgeFiles.map((path) => toVaultPath(path).replace(/\.md$/i, '')),
);
const records = knowledgeFiles.map((file) => {
  const relativePath = toVaultPath(file);
  const target = relativePath.replace(/\.md$/i, '');
  const text = readFileSync(file, 'utf8');
  const knowledgeLinks = wikilinks(text).filter((link) => knownKnowledge.has(link));
  return { file, relativePath, target, text, knowledgeLinks };
});
const inboundLinks = new Map(records.map(({ target }) => [target, new Set()]));

for (const record of records) {
  for (const target of record.knowledgeLinks) {
    if (target !== record.target) inboundLinks.get(target)?.add(record.target);
  }
}

for (const { file, relativePath, target, text, knowledgeLinks } of records) {
  if (!text.trim()) issues.push(`${relativePath}: 空ファイル`);

  const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) {
    const files = titles.get(h1) ?? [];
    files.push(relativePath);
    titles.set(h1, files);
  }

  if (relativePath !== 'knowledge/index.md') {
    if (!index.includes(`[[${target}`)) issues.push(`${relativePath}: knowledge/index.mdに未登録`);
  }

  const expectedType = relativePath === 'knowledge/index.md' ? 'index' : 'knowledge';
  const actualType = frontmatterValue(text, 'type');
  if (actualType && actualType !== expectedType) {
    issues.push(`${relativePath}: typeは「${expectedType}」が必要（現在: ${actualType}）`);
  }

  const markers = [...text.matchAll(/\b(?:TODO|FIXME)\b|要検証|未検証/g)];
  if (markers.length > 0) warnings.push(`${relativePath}: 未解決マーカー ${markers.length}件`);

  for (const link of wikilinks(text)) {
    if (!link.startsWith('knowledge/')) continue;
    if (!knownKnowledge.has(link)) issues.push(`${relativePath}: リンク切れ [[${link}]]`);
  }

  if (relativePath !== 'knowledge/index.md') {
    const outbound = new Set(knowledgeLinks.filter((link) => link !== target && link !== 'knowledge/index'));
    const inbound = new Set(
      [...(inboundLinks.get(target) ?? [])].filter((link) => link !== 'knowledge/index'),
    );
    const degree = new Set([...outbound, ...inbound]).size;
    const modifiedAt = statSync(file).mtime;
    const ageDays = Math.max(0, Math.floor((now.getTime() - modifiedAt.getTime()) / 86_400_000));

    if (degree === 0 && ageDays >= ORPHAN_AGE_DAYS) {
      orphanCandidates.push(`${relativePath}: ${ageDays}日間、他のknowledgeとの接続なし`);
    }
    if (degree <= 1 && ageDays >= STALE_LOW_LINK_AGE_DAYS) {
      staleLowLinkCandidates.push(`${relativePath}: ${ageDays}日経過、接続数${degree}`);
    }
  }
}

for (const [title, files] of titles) {
  if (files.length > 1) warnings.push(`重複H1「${title}」: ${files.join(', ')}`);
}

const indexTargets = wikilinks(index).filter((target) => target.startsWith('knowledge/'));
const indexTargetCounts = new Map();
for (const target of indexTargets) {
  indexTargetCounts.set(target, (indexTargetCounts.get(target) ?? 0) + 1);
  if (!knownKnowledge.has(target)) issues.push(`knowledge/index.md: 存在しないMOCリンク [[${target}]]`);
}
for (const [target, count] of indexTargetCounts) {
  if (count > 1) warnings.push(`knowledge/index.md: [[${target}]] が${count}回登録`);
}

const boundaryDirectories = [
  [rawDir, 'raw'],
  [reportsDir, 'reports'],
  [outputsDir, 'outputs'],
];
for (const [directory, label] of boundaryDirectories) {
  for (const file of walk(directory).filter((path) => extname(path).toLowerCase() === '.md')) {
    const text = readFileSync(file, 'utf8');
    if (frontmatterValue(text, 'type') === 'knowledge') {
      issues.push(`${toVaultPath(file)}: ${label}/内でtype: knowledgeを使用している`);
    }
  }
}
if (existsSync(join(OBSIDIAN, 'wiki'))) {
  issues.push('wiki/: knowledge/と重複するWikiディレクトリが存在');
}

warnings.push(...orphanCandidates, ...staleLowLinkCandidates);

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
- 30日以上の孤立候補: ${orphanCandidates.length}
- 90日以上の低接続候補: ${staleLowLinkCandidates.length}

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
- [ ] Wikiリンクの前後に関連理由が説明されているか
- [ ] rawの増加に対してknowledgeへの変換が停滞していないか
`;

if (!process.argv.includes('--check')) {
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `knowledge-health-${date.replaceAll('-', '')}.md`);
  writeFileSync(reportPath, report, 'utf8');
  console.log(reportPath);
}
console.log(`knowledge=${knowledgeFiles.length} raw=${rawFiles.length} outputs=${outputFiles.length} issues=${issues.length} warnings=${warnings.length}`);
if (process.argv.includes('--check') && issues.length > 0) {
  console.error(issues.map((item) => `- ${item}`).join('\n'));
}
if (issues.length > 0) process.exitCode = 1;
