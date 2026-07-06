import { basename } from 'path';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { BG_STYLES, BGM_TRACKS } from './config.js';

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

const extractSegmentsBlock = (raw) => {
  const start = raw.search(/^##\s*セグメント\s*$/m);
  if (start < 0) return '';
  const sectionStart = raw.indexOf('\n', start);
  const rest = raw.slice(sectionStart + 1);
  const next = rest.search(/^##\s/m);
  const section = next < 0 ? rest : rest.slice(0, next);
  if (!section) return '';
  return section.match(/```(?:yaml|yml)?\s*\r?\n([\s\S]*?)```/)?.[1]?.trim() ?? section.trim();
};

const parseSegments = (raw) => {
  const block = extractSegmentsBlock(raw);
  if (!block) return [];
  const data = parse(block);
  return Array.isArray(data?.segments) ? data.segments : [];
};

export function parseVideoScript(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const withoutFrontmatter = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const segments = parseSegments(raw);
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
    bgm: frontmatterValue(raw, 'bgm') ?? 'main',
    accentColor: frontmatterValue(raw, 'accentColor'),
    hookLabel: frontmatterValue(raw, 'hookLabel'),
    segments,
    lines: emphasisLines.length >= 2 ? emphasisLines : fallbackLines,
    plain: (segments.length > 0 ? segments.map((segment) => segment.text).filter(Boolean).join('\n') : withoutFrontmatter
      .replace(/\[強調\](.*?)\[\/強調\]/g, '$1')
      .replace(/\[速\](.*?)\[\/速\]/g, '$1')
      .replace(/\[間\]/g, ' ')
      .replace(/^#+.*$/gm, '')
      .replace(/\*\*/g, '')
      .replace(/---/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()),
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
  if (!Object.hasOwn(BGM_TRACKS, parsed.bgm)) {
    errors.push(`bgmが不正です: ${parsed.bgm}`);
  }
  if (parsed.accentColor && !/^#[0-9a-f]{6}$/i.test(parsed.accentColor)) {
    errors.push(`accentColorは6桁HEXで指定してください: ${parsed.accentColor}`);
  }
  if (parsed.segments.length === 0 && (parsed.lines.length < 2 || parsed.lines.length > 4)) {
    errors.push(`本編の要点は2〜4個必要です: ${parsed.lines.length}個`);
  }
  if (parsed.segments.length > 0) {
    const roles = new Set(['hook', 'body', 'cta']);
    const ctaCount = parsed.segments.filter((segment) => segment.role === 'cta').length;
    parsed.segments.forEach((segment, index) => {
      const label = `segments[${index}]`;
      if (!roles.has(segment.role)) errors.push(`${label}.roleが不正です: ${segment.role}`);
      if (typeof segment.text !== 'string' || !segment.text.trim()) errors.push(`${label}.textが空です`);
      if (!Array.isArray(segment.highlight)) errors.push(`${label}.highlightは配列で指定してください`);
      if (segment.role !== 'cta') {
        if (typeof segment.imagePrompt !== 'string' || !segment.imagePrompt.trim()) {
          errors.push(`${label}.imagePromptが空です`);
        } else {
          const prompt = segment.imagePrompt.toLowerCase();
          if (!prompt.includes('no logos')) errors.push(`${label}.imagePromptにno logosを含めてください`);
          if (!prompt.includes('no text') && !prompt.includes('no readable text')) {
            errors.push(`${label}.imagePromptにno textまたはno readable textを含めてください`);
          }
        }
      }
    });
    if (!parsed.segments.some((segment) => segment.role === 'hook')) errors.push('segmentsにhookが必要です');
    if (!parsed.segments.some((segment) => segment.role === 'body')) errors.push('segmentsにbodyが必要です');
    if (ctaCount < 1) errors.push('segmentsにctaが必要です');
  }
  if (!parsed.plain) errors.push('読み上げ本文が空です');

  return { parsed, errors };
}
