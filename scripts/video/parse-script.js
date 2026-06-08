import { basename } from 'path';
import { readFileSync } from 'fs';
import { BG_STYLES } from './config.js';

const stripMarks = (value = '') => value
  .replace(/\[強調\](.*?)\[\/強調\]/g, '$1')
  .replace(/\[速\](.*?)\[\/速\]/g, '$1')
  .replace(/\[間\]/g, '')
  .replace(/\*\*/g, '')
  .trim();

const frontmatterValue = (raw, key) => {
  const match = raw.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return match?.[1]?.trim();
};

export function parseVideoScript(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const withoutFrontmatter = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const headingTitle = raw.match(/^# (.+)$/m)?.[1] ?? basename(filePath, '.md');
  const hookEmphasis = raw.match(/###\s*フック[\s\S]*?\[強調\](.*?)\[\/強調\]/);
  const hookSection = raw.match(/###\s*フック[^\n]*\n+([^\n#]+)/);
  const ctaSection = raw.match(/###\s*CTA[^\n]*\n+([\s\S]*?)(?=\n---|\n##|$)/);
  const honpen = raw.match(/###\s*本編[\s\S]*?(?=\n###|\n##|$)/)?.[0] ?? '';

  const emphasisLines = [...honpen.matchAll(/\[強調\](.*?)\[\/強調\]/g)]
    .map((match) => stripMarks(match[1]))
    .filter(Boolean)
    .slice(0, 4);
  const fallbackLines = honpen
    .split('\n')
    .map(stripMarks)
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('[') && line.length > 5)
    .slice(0, 4);

  const ctaFromSection = ctaSection?.[1]
    .split('\n')
    .map(stripMarks)
    .find(Boolean);

  return {
    raw,
    title: frontmatterValue(raw, 'title') ?? headingTitle,
    hook: frontmatterValue(raw, 'hook')
      ?? (hookEmphasis ? stripMarks(hookEmphasis[1]) : undefined)
      ?? (hookSection ? stripMarks(hookSection[1]) : undefined)
      ?? headingTitle,
    cta: (frontmatterValue(raw, 'cta') ?? ctaFromSection ?? 'プロフのリンクをチェック👆').slice(0, 30),
    bgStyle: frontmatterValue(raw, 'bgStyle') ?? 'bokeh',
    accentColor: frontmatterValue(raw, 'accentColor'),
    hookLabel: frontmatterValue(raw, 'hookLabel'),
    lines: emphasisLines.length >= 2 ? emphasisLines : fallbackLines,
    plain: withoutFrontmatter
      .replace(/\[強調\](.*?)\[\/強調\]/g, '$1')
      .replace(/\[速\](.*?)\[\/速\]/g, '$1')
      .replace(/\[間\]/g, ' ')
      .replace(/^#+.*$/gm, '')
      .replace(/\*\*/g, '')
      .replace(/---/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  };
}

export function validateVideoScript(filePath) {
  const parsed = parseVideoScript(filePath);
  const errors = [];
  const required = ['title', 'hook', 'cta', 'bgStyle', 'accentColor', 'hookLabel'];

  if (!parsed.raw.startsWith('---')) errors.push('YAML frontmatterがありません');
  for (const key of required) {
    if (!frontmatterValue(parsed.raw, key)) errors.push(`${key} がfrontmatterにありません`);
  }
  if (!BG_STYLES.includes(parsed.bgStyle)) {
    errors.push(`bgStyleが不正です: ${parsed.bgStyle}`);
  }
  if (parsed.accentColor && !/^#[0-9a-f]{6}$/i.test(parsed.accentColor)) {
    errors.push(`accentColorは6桁HEXで指定してください: ${parsed.accentColor}`);
  }
  if (parsed.lines.length < 2 || parsed.lines.length > 4) {
    errors.push(`本編の要点は2〜4個必要です: ${parsed.lines.length}個`);
  }
  if (!parsed.plain) errors.push('読み上げ本文が空です');

  return { parsed, errors };
}
