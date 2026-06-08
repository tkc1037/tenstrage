#!/usr/bin/env node
/**
 * notebooklm-debug.js — --headless=false で ask_question を試す
 * Chrome が開くので、クリック失敗時に何が起きているか確認する
 */

import { spawn, execSync } from 'child_process';

// Chrome クリーンアップ
try {
  execSync('powershell -Command "Get-WmiObject Win32_Process -Filter \'Name=\\\"chrome.exe\\\"\' | Where-Object { $_.CommandLine -like \'*notebooklm-mcp*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', { stdio:'ignore', shell:true });
} catch {}
await new Promise(r => setTimeout(r, 2000));

console.log('🔍 --headless=false でデバッグ起動...');

const env = { ...process.env, NOTEBOOKLM_HEADLESS: 'false' };
const proc = spawn('npx', ['notebooklm-mcp@2.0.0', '--headless=false'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  env,
});

let buf = '';
proc.stdout.on('data', d => { buf += d.toString(); });
proc.stderr.on('data', () => {});

const send = (method, params, id) =>
  proc.stdin.write(JSON.stringify({ jsonrpc:'2.0', method, params, id }) + '\n');
const notify = (method, params) =>
  proc.stdin.write(JSON.stringify({ jsonrpc:'2.0', method, params }) + '\n');

function waitFor(id, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const t = Date.now();
    const iv = setInterval(() => {
      for (const line of buf.split('\n')) {
        try {
          const j = JSON.parse(line);
          if (j.id === id) { clearInterval(iv); resolve(j.result?.content?.[0]?.text ?? ''); return; }
        } catch {}
      }
      if (Date.now() - t > timeout) { clearInterval(iv); reject(new Error('timeout')); }
    }, 300);
  });
}

await new Promise(r => setTimeout(r, 4000));
send('initialize', { protocolVersion:'2024-11-05', capabilities:{}, clientInfo:{name:'debug',version:'1'} }, 1);
await waitFor(1, 10000);
notify('notifications/initialized', {});
await new Promise(r => setTimeout(r, 500));

// select_notebook
console.log('ノートブック選択中...');
send('tools/call', { name:'select_notebook', arguments:{ id:'tenstrage-knowledge' } }, 2);
const sel = await waitFor(2, 15000);
console.log('select result:', sel.slice(0,100));

// 30秒待つ（Chrome でページが開くのを待つ）
console.log('Chrome でページが開くのを30秒待ちます...');
await new Promise(r => setTimeout(r, 30000));

// ask_question
console.log('ask_question 送信...');
send('tools/call', { name:'ask_question', arguments:{ question:'記事品質基準を1行で要約してください。' } }, 3);

try {
  const ans = await waitFor(3, 90000);
  console.log('回答:', ans.slice(0, 300));
} catch (e) {
  console.log('タイムアウト/エラー:', e.message);
}

proc.stdin.end();
setTimeout(() => { try { proc.kill(); } catch {} }, 1000);
process.exit(0);
