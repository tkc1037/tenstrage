import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

export function readReview(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`frontmatterがありません: ${filePath}`);
  return {
    raw,
    data: parse(match[1]) ?? {},
    body: raw.slice(match[0].length),
  };
}

export function writeReview(filePath, data, body) {
  const frontmatter = stringify(data, { lineWidth: 0 }).trim();
  writeFileSync(filePath, `---\n${frontmatter}\n---\n\n${body.trim()}\n`, 'utf8');
}

export function updateReviewData(filePath, patch) {
  const review = readReview(filePath);
  writeReview(filePath, { ...review.data, ...patch }, review.body);
}

export function getSection(body, heading) {
  const marker = `## ${heading}`;
  const start = body.indexOf(marker);
  if (start < 0) return '';
  const contentStart = body.indexOf('\n', start + marker.length);
  if (contentStart < 0) return '';
  const rest = body.slice(contentStart + 1);
  const nextHeading = rest.search(/^## /m);
  return (nextHeading < 0 ? rest : rest.slice(0, nextHeading)).trim();
}

export function getCodeBlock(section) {
  return section.match(/```[^\r\n]*\r?\n([\s\S]*?)```/)?.[1]?.trim() ?? '';
}
