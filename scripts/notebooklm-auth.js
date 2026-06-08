#!/usr/bin/env node
/**
 * notebooklm-auth.js — NotebookLM の Google 認証を完了させる
 *
 * 実行: node scripts/notebooklm-auth.js
 *
 * Chrome が開くので Google アカウントにログインしてください。
 * ログイン完了後、Enter を押すと終了します。
 */

import { spawn } from 'child_process';
import * as readline from 'readline';

console.log('🔐 NotebookLM 認証スクリプト\n');

const proc = spawn('npx', ['notebooklm-mcp@2.0.0', '--headless=false'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});

let buf = '';
proc.stdout.on('data', d => { buf += d.toString(); });
proc.stderr.on('data', d => {
  const msg = d.toString();
  // 重要なメッセージのみ表示
  if (msg.includes('✅') || msg.includes('❌') || msg.includes('🔐') || msg.includes('error') || msg.includes('Error')) {
    process.stdout.write(msg);
  }
});

const send = (method, params, id) =>
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n');
const notify = (method, params) =>
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');

function waitForResponse(id, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      const lines = buf.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          if (j.id === id) {
            clearInterval(check);
            resolve(j.result?.content?.[0]?.text ?? JSON.stringify(j.result));
            return;
          }
        } catch {}
      }
      if (Date.now() - start > timeout) {
        clearInterval(check);
        reject(new Error('タイムアウト'));
      }
    }, 500);
  });
}

async function main() {
  // 起動待ち
  console.log('⏳ MCP サーバー起動中...');
  await new Promise(r => setTimeout(r, 4000));

  // 初期化
  send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'auth-setup', version: '1.0' },
  }, 1);
  await waitForResponse(1, 10000);
  notify('notifications/initialized', {});
  await new Promise(r => setTimeout(r, 500));

  // setup_auth 呼び出し → Chrome が開く
  console.log('🌐 Chrome を起動中... (--headless=false)');
  send('tools/call', { name: 'setup_auth', arguments: {} }, 2);

  let result;
  try {
    result = await waitForResponse(2, 90000);
    console.log('\n✅ 認証結果:', result?.slice(0, 200));
  } catch (e) {
    console.log('\n⚠️  タイムアウト。Chrome でログイン中の場合は続行してください。');
  }

  // ヘルスチェック
  send('tools/call', { name: 'get_health', arguments: {} }, 3);
  try {
    const health = await waitForResponse(3, 15000);
    const h = JSON.parse(health);
    console.log(`\n📊 認証状態: ${h.data?.authenticated ? '✅ 認証済み' : '❌ 未認証'}`);
    if (h.data?.authenticated) {
      console.log('\n🎉 認証完了！次のコマンドでパイプラインを実行できます：');
      console.log('   node scripts/notebooklm-sync.js');
    } else {
      console.log('\n⚠️  Chrome で Google アカウントにログインしてください。');
      console.log('   ログイン後、Enter を押してください。');

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      await new Promise(resolve => rl.question('ログイン完了後 Enter: ', () => { rl.close(); resolve(); }));

      // 再チェック
      send('tools/call', { name: 'get_health', arguments: {} }, 4);
      const health2 = await waitForResponse(4, 15000);
      const h2 = JSON.parse(health2);
      console.log(`認証状態: ${h2.data?.authenticated ? '✅ 認証済み' : '❌ まだ未認証'}`);
    }
  } catch {}

  proc.stdin.end();
  setTimeout(() => { try { proc.kill(); } catch {} }, 1000);
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
