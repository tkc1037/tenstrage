import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const id = 'G-WZPP0MPJCW';
const loader = `https://www.googletagmanager.com/gtag/js?id=${id}`;
function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith('.html') ? [path] : [];
  });
}
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1]).find((script) => script.includes(`ga-disable-${id}`));

test('Every built HTML document has exactly one loader and config, in its head', () => {
  const files = htmlFiles(dist);
  assert.ok(files.length >= 37);
  for (const path of files) {
    const page = readFileSync(path, 'utf8');
    const head = page.match(/<head>([\s\S]*?)<\/head>/)?.[1];
    assert.ok(head, path);
    assert.equal(page.split(loader).length - 1, 1, path);
    assert.equal((page.match(/gtag\('config', 'G-WZPP0MPJCW'\)/g) || []).length, 1, path);
    assert.ok(head.indexOf(`ga-disable-${id}`) < head.indexOf(loader), path);
  }
  const source = readFileSync(join(root, 'src/layouts/BaseLayout.astro'), 'utf8');
  assert.match(source, /<script is:inline>\s*window\.dataLayer/);
  assert.match(source, /<script is:inline async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-WZPP0MPJCW"/);
});

function initialize(url, optedOut = false) {
  // Test the real rendered initializer in isolation; never contact Google.
  const location = new URL(url);
  const context = { location, Date };
  context.window = context;
  if (optedOut) context[`ga-disable-${id}`] = true;
  runInNewContext(initScript, context);
  return context;
}

test('Production queues one page config and preserves an existing opt-out', () => {
  assert.ok(initScript);
  for (const path of ['/', '/articles/go-app-guide/', '/start/tiktok/']) {
    const context = initialize(`https://takuzo-taxi.com${path}`);
    assert.equal(context.dataLayer.length, 2);
    assert.equal(context.dataLayer[0][0], 'js');
    assert.equal(context.dataLayer[1][0], 'config');
    assert.equal(context.dataLayer[1][1], id);
    assert.notEqual(context[`ga-disable-${id}`], true);
  }
  assert.equal(initialize('https://takuzo-taxi.com/', true)[`ga-disable-${id}`], true);
});

test('Localhost, preview domains and non-HTTPS never queue collection config', () => {
  for (const url of ['http://127.0.0.1:4321/', 'http://localhost:4321/', 'https://preview.pages.dev/', 'http://takuzo-taxi.com/']) {
    const context = initialize(url);
    assert.equal(context[`ga-disable-${id}`], true, url);
    assert.equal(context.dataLayer.length, 0, url);
  }
});

test('Privacy disclosure retains Cloudflare and explains GA4 cookies and opt-out', () => {
  const policy = readFileSync(join(dist, 'privacy/index.html'), 'utf8');
  for (const content of ['Google アナリティクス（GA4）', '_ga', 'Cloudflare Web Analytics', 'https://tools.google.com/dlpage/gaoptout?hl=ja', 'https://policies.google.com/privacy?hl=ja']) {
    assert.ok(policy.includes(content), content);
  }
});
