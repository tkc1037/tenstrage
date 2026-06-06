#!/usr/bin/env node
/**
 * notebooklm-client.js — notebooklm-mcp と JSON-RPC over stdio で通信するヘルパー
 *
 * 使い方:
 *   import { NlmSession } from './notebooklm-client.js';
 *
 *   const nlm = new NlmSession();
 *   await nlm.connect();
 *   await nlm.openNotebook(notebookId); // ブラウザでノートブックを開く
 *   const answer = await nlm.chat('質問文');
 *   await nlm.addSource({ text: '...', title: 'ファイル名' });
 *   nlm.close();
 *
 * 単発ヘルパー（後方互換）:
 *   import { nlmChat, nlmAddSource } from './notebooklm-client.js';
 */

import { spawn, execSync } from 'child_process';

const NLM_BASE = 'https://notebooklm.google.com/notebook';
const toUrl = (id) => `${NLM_BASE}/${id}`;

// notebooklm-mcp が使う Chrome プロファイルのロックを解放
function killNotebooklmChrome() {
  try {
    execSync(
      'powershell -Command "Get-WmiObject Win32_Process -Filter \'Name=\\\"chrome.exe\\\"\' | Where-Object { $_.CommandLine -like \'*notebooklm-mcp*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
      { stdio: 'ignore', shell: true }
    );
  } catch {}
  // ロックファイル削除
  try {
    execSync('del /F /Q "C:\\Users\\wtknt\\AppData\\Local\\notebooklm-mcp\\Data\\chrome_profile\\Default\\LOCK" 2>nul', { stdio: 'ignore', shell: true });
    execSync('del /F /Q "C:\\Users\\wtknt\\AppData\\Local\\notebooklm-mcp\\Data\\chrome_profile\\lockfile" 2>nul', { stdio: 'ignore', shell: true });
  } catch {}
}

// ─── MCP クライアント（接続を維持するセッション型） ──────
export class NlmSession {
  constructor() {
    this.proc = null;
    this.pending = new Map();
    this.nextId = 1;
    this.buffer = '';
    this.currentSessionId = null;
  }

  async connect() {
    // 前回の残留 Chrome プロセスをクリーンアップ
    killNotebooklmChrome();
    await new Promise(r => setTimeout(r, 1500));

    this.proc = spawn('npx', ['notebooklm-mcp@latest'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, STEALTH_ENABLED: 'false' },
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        } catch {}
      }
    });

    this.proc.stderr.on('data', () => {});

    await this._send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'tenstrage-pipeline', version: '1.0' },
    });
    this._notify('notifications/initialized', {});

    // MCP プロセス起動を少し待つ
    await new Promise(r => setTimeout(r, 1000));
  }

  _notify(method, params) {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    this.proc.stdin.write(msg);
  }

  _send(method, params) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n';
      this.proc.stdin.write(msg);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP タイムアウト: ${method}`));
        }
      }, 60000); // ブラウザ起動が遅いため60秒
    });
  }

  async callTool(name, args) {
    const result = await this._send('tools/call', { name, arguments: args });
    return result?.content?.[0]?.text ?? '';
  }

  /**
   * ノートブックをアクティブ化してブラウザセッション確立
   * @param {string} notebookId  UUID（.envのNLM_*_ID）
   */
  async openNotebook(notebookId) {
    // library.json の local ID にマッピング
    const localIdMap = {
      '66be25c2-3634-45bd-b857-dced93768147': 'tenstrage-knowledge',
      '322bf765-78c6-467e-8372-ddb4cbe5ac46': 'tenstrage-research',
      '3861836f-b123-4d23-951d-d5056bc8ff5a': 'tenstrage-video',
      '654a7db0-8116-4d9e-a2b2-c71847b6e47e': 'tenstrage-affiliate',
      '9074a16f-87b3-400c-a674-3e2ff82b3744': 'tenstrage-remotion',
    };
    const localId = localIdMap[notebookId];

    if (localId) {
      // 既登録ノートブックを select（Chrome セッション作成）
      const raw = await this.callTool('select_notebook', { id: localId });
      try {
        const result = JSON.parse(raw);
        this.currentSessionId = result.session_id ?? result.id ?? null;
      } catch {}
    } else {
      // 未登録の場合は add_notebook で登録
      const raw = await this.callTool('add_notebook', {
        url: toUrl(notebookId),
        name: `notebook-${notebookId.slice(0, 8)}`,
      });
      try {
        const result = JSON.parse(raw);
        this.currentSessionId = result.session_id ?? result.id ?? null;
      } catch {}
    }

    // ページロード完了待ち（チャット欄が interactive になるまで）
    await new Promise(r => setTimeout(r, 20000));
  }

  /**
   * チャットクエリを送信（openNotebook 後に呼ぶ）
   * @param {string} question
   * @returns {string}
   */
  async chat(question) {
    const args = { question };
    if (this.currentSessionId) args.session_id = this.currentSessionId;
    return await this.callTool('ask_question', args);
  }

  /**
   * ソースを追加（openNotebook 後に呼ぶ）
   * @param {{ url?: string, text?: string, title?: string }} source
   */
  async addSource(source) {
    if (source.url) {
      await this.callTool('add_source', { type: 'url', content: source.url });
    } else if (source.text) {
      const args = { type: 'text', content: source.text };
      if (source.title) args.title = source.title;
      await this.callTool('add_source', args);
    }
  }

  close() {
    if (this.proc) {
      this.proc.stdin.end();
      // プロセスに少し時間を与えてから強制終了
      setTimeout(() => { try { this.proc.kill(); } catch {} }, 500);
    }
  }
}

// ─── 単発ヘルパー（後方互換・pipeline.js から使用） ───────

/**
 * ノートブックにクエリを送信
 */
export async function nlmChat(notebookId, query) {
  const nlm = new NlmSession();
  try {
    await nlm.connect();
    await nlm.openNotebook(notebookId);
    return await nlm.chat(query);
  } finally {
    nlm.close();
    // Chrome プロファイルロック解放のため少し待つ
    await new Promise(r => setTimeout(r, 2000));
  }
}

/**
 * ノートブックにソース追加
 */
export async function nlmAddSource(notebookId, source) {
  const nlm = new NlmSession();
  try {
    await nlm.connect();
    await nlm.openNotebook(notebookId);
    await nlm.addSource(source);
  } finally {
    nlm.close();
    await new Promise(r => setTimeout(r, 2000));
  }
}

/**
 * ノートブックを登録（openNotebook と同じ）
 */
export async function nlmRegisterNotebook(notebookId, name) {
  const nlm = new NlmSession();
  try {
    await nlm.connect();
    await nlm.callTool('add_notebook', { url: toUrl(notebookId), name });
  } finally {
    nlm.close();
    await new Promise(r => setTimeout(r, 2000));
  }
}
