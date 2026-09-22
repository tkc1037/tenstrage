import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { questions } from '../src/lib/questions.ts';
import { matchesQuestion, normalizeSearch } from '../src/lib/question-search.mjs';
import { driversWorkUrl } from '../src/lib/affiliate.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const read = (path) => readFileSync(join(dist, path), 'utf8');
const decode = (text) => text.replaceAll('&amp;', '&').replaceAll('&#38;', '&');
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
const anchors = (html) => [...html.matchAll(/<a\s[^>]*>/g)].map((match) => attributes(match[0]));
const metadata = (html, name) => [...html.matchAll(/<(?:meta|link)\s[^>]*>/g)].map((match) => attributes(match[0])).find((item) => item.name === name || item.rel === name || item.property === name);
const findQuestions = (query, category = '') => questions.filter((item) => matchesQuestion(`${item.question} ${item.answer} ${item.keywords}`, query, item.category, category));

test('Japanese variants, AND search, category intersection, empty and no-results queries', () => {
  assert.equal(normalizeSearch('　ＧＯ　ｺﾞｰ '), 'go ごー');
  assert.ok(findQuestions('免許代').some((item) => item.id === 'license-cost'));
  assert.ok(findQuestions('２種免許').some((item) => item.id === 'license-cost'));
  assert.ok(findQuestions('ごー').some((item) => item.id === 'go-vehicle'));
  assert.ok(findQuestions('寮　費用', 'housing').length > 0);
  assert.equal(findQuestions('寮　費用', 'service').length, 0);
  assert.equal(findQuestions('存在しない検索語xyz').length, 0);
  assert.equal(findQuestions('  ').length, 18);
  assert.equal(findQuestions('', 'housing').length, 3);
});

test('All answers are prerendered with unique stable anchors and real local destinations', () => {
  const html = read('questions/index.html');
  const renderedAnswers = [...html.matchAll(/<div class="answer"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map((match) => decode(match[1]));
  assert.equal(new Set(questions.map((item) => item.id)).size, 18);
  assert.equal((html.match(/<details\s[^>]*data-question-item/g) || []).length, 18);
  for (const item of questions) {
    assert.ok(html.includes(`id="${item.id}"`), item.id);
    assert.ok(renderedAnswers.includes(item.answer), `${item.id}: missing static answer`);
  }
  const pages = ['index.html', 'questions/index.html', 'preparation/index.html', 'start/tiktok/index.html', 'start/instagram/index.html', 'contact/index.html'];
  for (const page of pages) {
    for (const { href } of anchors(read(page))) {
      if (!href || (!href.startsWith('/') && !href.startsWith('#'))) continue;
      const base = new URL(page.replace(/index\.html$/, ''), 'https://takuzo-taxi.com/');
      const url = new URL(href, base);
      const target = join(dist, decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '');
      assert.ok(existsSync(target), `${page}: broken link ${href}`);
      if (url.hash) {
        const targetHtml = readFileSync(target, 'utf8');
        assert.ok(targetHtml.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${page}: missing anchor ${href}`);
      }
    }
  }
});

test('Every public article has 1–3 disclosed ads with the exact issued URL and sponsored rel', () => {
  const articleDirs = readdirSync(join(dist, 'articles'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const sources = readdirSync(join(root, 'src/content/articles')).filter((file) => /^draft:\s*false/m.test(readFileSync(join(root, 'src/content/articles', file), 'utf8')));
  assert.equal(articleDirs.length, sources.length);
  for (const entry of articleDirs) {
    const html = read(`articles/${entry.name}/index.html`);
    const ads = anchors(html).filter((item) => item.href?.startsWith('https://px.a8.net/'));
    assert.ok(ads.length >= 1 && ads.length <= 3, `${entry.name}: ${ads.length} ads`);
    for (const ad of ads) {
      assert.equal(ad.href, driversWorkUrl, entry.name);
      assert.ok(ad.rel?.split(' ').includes('sponsored'), entry.name);
      assert.ok(ad['data-affiliate-placement'], entry.name);
    }
    assert.ok(html.includes('【PR】'), entry.name);
    assert.ok(!html.includes('無料検索する</a>'), entry.name);
  }
});

test('Social entry pages share home content, canonical, robots and sitemap rules', () => {
  const home = read('index.html');
  const sitemap = readdirSync(dist).filter((file) => /^sitemap.*\.xml$/.test(file)).map(read).join('');
  for (const source of ['tiktok', 'instagram']) {
    const html = read(`start/${source}/index.html`);
    assert.equal(metadata(html, 'canonical').href, 'https://takuzo-taxi.com/');
    assert.equal(metadata(html, 'robots').content, 'noindex, follow');
    assert.equal(metadata(html, 'og:url').content, 'https://takuzo-taxi.com/');
    assert.equal(metadata(html, 'description').content, metadata(home, 'description').content);
    assert.ok(!sitemap.includes(`/start/${source}`));
    assert.ok(decode(html).includes('Q&Aで疑問を解消する'));
    assert.ok(!html.includes('http-equiv="refresh"'));
  }
  for (const page of ['index.html', 'questions/index.html', 'preparation/index.html']) {
    const html = read(page);
    const canonical = new URL(metadata(html, 'canonical').href);
    assert.equal(canonical.origin, 'https://takuzo-taxi.com');
    assert.equal(canonical.search, '');
    assert.ok(!metadata(html, 'robots'));
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
  }
});
