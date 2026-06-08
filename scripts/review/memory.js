import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import { OBSIDIAN } from '../paths.js';
import { getSection, readReview, updateReviewData } from './markdown.js';

export const MEMORY_PATH = join(OBSIDIAN, 'rules', 'content-memory.yml');
const CORRECTIONS_PATH = join(OBSIDIAN, 'rules', 'corrections.md');

const emptyMemory = () => ({
  version: 1,
  pronunciations: {},
  replacements: { global: [], video: [], x: [] },
  avoid: { global: [], video: [], x: [] },
});

export function loadContentMemory() {
  if (!existsSync(MEMORY_PATH)) return emptyMemory();
  const loaded = parse(readFileSync(MEMORY_PATH, 'utf8')) ?? {};
  return {
    ...emptyMemory(),
    ...loaded,
    pronunciations: loaded.pronunciations ?? {},
    replacements: { ...emptyMemory().replacements, ...(loaded.replacements ?? {}) },
    avoid: { ...emptyMemory().avoid, ...(loaded.avoid ?? {}) },
  };
}

export function saveContentMemory(memory) {
  writeFileSync(MEMORY_PATH, stringify(memory, { lineWidth: 0 }), 'utf8');
}

function replacementsFor(memory, medium) {
  return [...(memory.replacements.global ?? []), ...(memory.replacements[medium] ?? [])];
}

export function applyContentMemory(text, medium, { pronunciation = false } = {}) {
  const memory = loadContentMemory();
  let result = text;
  for (const rule of replacementsFor(memory, medium)) {
    if (rule?.from) result = result.split(rule.from).join(rule.to ?? '');
  }
  if (pronunciation) {
    const entries = Object.entries(memory.pronunciations)
      .sort(([left], [right]) => right.length - left.length);
    for (const [term, reading] of entries) {
      result = result.split(term).join(reading);
    }
  }
  return result;
}

export function findAvoidedTerms(text, medium) {
  const memory = loadContentMemory();
  return [...new Set([...(memory.avoid.global ?? []), ...(memory.avoid[medium] ?? [])])]
    .filter((term) => term && text.includes(term));
}

export function parseMemoryCommands(section) {
  const commands = [];
  for (const sourceLine of section.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line.startsWith('- ')) continue;
    const match = line.match(/^-\s*(reading|global|video|x|avoid-global|avoid-video|avoid-x):\s*(.+?)(?:\s*=>\s*(.*))?$/);
    if (match) commands.push({ type: match[1], from: match[2].trim(), to: match[3]?.trim() });
  }
  return commands;
}

function addReplacement(list, from, to) {
  const current = list.find((rule) => rule.from === from);
  if (current) current.to = to;
  else list.push({ from, to });
}

function appendCorrectionsLog(commands, source) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = commands.map((command) => {
    if (command.type === 'reading') return `- 今後：「${command.from}」は「${command.to}」と読む`;
    if (command.type.startsWith('avoid-')) return `- 今後：${command.type.slice(6)}で「${command.from}」を使用しない`;
    return `- 今後：${command.type}で「${command.from}」を「${command.to}」へ置換する`;
  });
  const existing = readFileSync(CORRECTIONS_PATH, 'utf8');
  const entry = `\n## ${date} content-review\n- 指摘：${source} の確認で恒久修正を登録\n${lines.join('\n')}\n`;
  const marker = '<!-- ここから下に追記していく。最新を上に。 -->';
  const updated = existing.includes(marker)
    ? existing.replace(marker, `${marker}\n${entry}`)
    : `${existing.trimEnd()}\n${entry}`;
  writeFileSync(CORRECTIONS_PATH, updated, 'utf8');
}

export function rememberReviewCorrections(reviewPath) {
  const review = readReview(reviewPath);
  if (review.data.memoryApplied === true) {
    throw new Error('このレビューの修正は記憶済みです。追加登録する場合は memoryApplied をfalseへ戻してください');
  }
  const section = getSection(review.body, '記憶する修正');
  const commands = parseMemoryCommands(section);
  if (commands.length === 0) throw new Error('「記憶する修正」に登録可能な行がありません');

  const memory = loadContentMemory();
  for (const command of commands) {
    if (command.type === 'reading') {
      if (!command.to) throw new Error(`読み方がありません: ${command.from}`);
      memory.pronunciations[command.from] = command.to;
    } else if (command.type.startsWith('avoid-')) {
      const medium = command.type.slice(6);
      if (!memory.avoid[medium].includes(command.from)) memory.avoid[medium].push(command.from);
    } else {
      if (!command.to) throw new Error(`置換後の表現がありません: ${command.from}`);
      addReplacement(memory.replacements[command.type], command.from, command.to);
    }
  }

  saveContentMemory(memory);
  appendCorrectionsLog(commands, review.data.source ?? reviewPath);
  updateReviewData(reviewPath, {
    memoryApplied: true,
    memoryAppliedAt: new Date().toISOString(),
  });
  return commands;
}
