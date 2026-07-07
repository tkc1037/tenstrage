#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { OBSIDIAN } from './paths.js';

const GROUPS = [
  {
    label: 'articles',
    dir: join(OBSIDIAN, 'reviews', 'articles'),
    idField: 'slug',
    flags: ['duplicateChecked', 'factChecked', 'qualityApproved', 'publishApproved'],
    headings: ['dup', 'fact', 'quality', 'publish'],
  },
  {
    label: 'x',
    dir: join(OBSIDIAN, 'reviews', 'x'),
    idField: 'postId',
    flags: ['duplicateChecked', 'factChecked', 'contentApproved', 'publishApproved'],
    headings: ['dup', 'fact', 'content', 'publish'],
  },
];

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return parse(match[1]) ?? {};
  } catch {
    return null;
  }
}

function flagValue(data, body, flag) {
  if (data && Object.prototype.hasOwnProperty.call(data, flag)) {
    return data[flag] === true;
  }

  const pattern = new RegExp(`${flag}\\s*:\\s*(true|false)`, 'i');
  const match = body.match(pattern);
  if (match) return match[1].toLowerCase() === 'true';

  return null;
}

function statusFor(row, flags) {
  if (row.unknown.length > 0) return 'フォーマット不明';
  const missing = flags.find((flag) => row.values[flag] !== true);
  return missing ? `${missing}待ち` : '公開可能';
}

function readRows(group) {
  if (!existsSync(group.dir)) return [];

  return readdirSync(group.dir)
    .filter((name) => name.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .map((name) => {
      const path = join(group.dir, name);
      const text = readFileSync(path, 'utf8');
      const data = parseFrontmatter(text);
      if (group.label === 'articles' && (data?.status === 'outline-review' || data?.bodyGenerated === false)) {
        return null;
      }

      const id = data?.[group.idField] || data?.slug || data?.postId || basename(name, '.md');
      const values = {};
      const unknown = [];

      for (const flag of group.flags) {
        values[flag] = flagValue(data, text, flag);
        if (values[flag] === null) unknown.push(flag);
      }

      return {
        id,
        values,
        unknown,
      };
    })
    .filter(Boolean);
}

function pad(value, width) {
  const text = String(value);
  return text + ' '.repeat(Math.max(1, width - text.length));
}

function mark(value) {
  if (value === true) return 'OK';
  if (value === false) return 'NG';
  return '--';
}

let ready = 0;
let waiting = 0;

for (const group of GROUPS) {
  const rows = readRows(group);
  const idWidth = Math.max(22, ...rows.map((row) => String(row.id).length));
  const widths = group.headings.map((heading) => Math.max(heading.length, 7));

  console.log(`[${group.label}]`);
  console.log(
    `${pad(group.label === 'articles' ? 'slug' : 'postId', idWidth)} ${group.headings
      .map((heading, index) => pad(heading, widths[index]))
      .join(' ')} -> 状態`,
  );

  for (const row of rows) {
    const state = statusFor(row, group.flags);
    if (state === '公開可能') ready += 1;
    else waiting += 1;

    console.log(
      `${pad(row.id, idWidth)} ${group.flags
        .map((flag, index) => pad(mark(row.values[flag]), widths[index]))
        .join(' ')} -> ${state}`,
    );
  }

  if (rows.length === 0) console.log('(対象なし)');
  console.log('');
}

console.log(`サマリー: 公開可能 ${ready}件 / 承認待ち ${waiting}件`);
