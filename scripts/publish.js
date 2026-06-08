#!/usr/bin/env node
/**
 * publish.js — 記事公開 + SNS投稿 自動実行スクリプト
 *
 * 実行: node scripts/publish.js
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { ROOT, OBSIDIAN, loadEnv } from './paths.js';

// ─── Buffer GraphQL 呼び出し ─────────────────────────────
async function bufferPost({ apiKey, channelId, text, dueAt, videoUrl = null, assetOverride = null, postMetadata = null }) {
  const query = `
    mutation($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id text status dueAt }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;
  const input = {
    channelId,
    text,
    mode: 'customScheduled',
    schedulingType: 'automatic',
    dueAt,
    ...(assetOverride ? { assets: assetOverride } : videoUrl ? { assets: { video: { url: videoUrl } } } : {}),
    ...(postMetadata ? { metadata: postMetadata } : {}),
  };
  const variables = { input };

  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }

  const result = json.data?.createPost;
  if (result?.message) throw new Error(result.message); // MutationError
  return result?.post;
}

// ─── SNSドラフト パース ──────────────────────────────────
function parseDraft(dateStr) {
  const path = join(ROOT, 'sns-drafts', `${dateStr}.md`);
  if (!existsSync(path)) {
    console.error(`❌ ドラフトが見つかりません: ${path}`);
    process.exit(1);
  }

  const content = readFileSync(path, 'utf8');
  const posts = [];

  // コードブロック（```で囲まれた投稿本文）を抽出
  const blocks = content.matchAll(/### 投稿(\d+)：([^\n]+)\n[\s\S]*?本文：\n```\n([\s\S]*?)```/g);
  for (const block of blocks) {
    posts.push({
      index: block[1],
      type: block[2].trim(),
      text: block[3].trim(),
    });
  }

  return posts;
}

// ─── task-diary 記録 ─────────────────────────────────────
function logDiary(entry) {
  const path = `${OBSIDIAN}/task-diary.md`;
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const log = `\n### ${timestamp} publish.js\n${entry}\n`;
  writeFileSync(path, log + existing);
}

// ─── Git コミット・プッシュ ──────────────────────────────
function gitPush(dateStr) {
  console.log('\n📦 GitHubにプッシュ中...');
  try {
    execSync('git add src/content/articles/ public/video/ public/audio/', { cwd: ROOT, stdio: 'inherit' });
    if (existsSync(join(ROOT, 'public', 'images'))) {
      execSync('git add public/images/', { cwd: ROOT, stdio: 'inherit' });
    }
    const status = execSync('git status --short', { cwd: ROOT }).toString().trim();
    if (!status) {
      console.log('⚠️  変更なし。スキップ。');
      return false;
    }
    execSync(`git commit -m "[${dateStr}] 記事・動画追加"`, { cwd: ROOT, stdio: 'inherit' });
    execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
    console.log('✅ プッシュ完了');
    return true;
  } catch (e) {
    console.error('❌ Gitエラー:', e.message);
    return false;
  }
}

// ─── メイン ──────────────────────────────────────────────
async function main() {
  const env = loadEnv();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const apiKey = env.BUFFER_API_KEY;

  const channels = {
    X:       { id: env.BUFFER_X_CHANNEL_ID,       label: 'X（Twitter）' },
    TikTok:  { id: env.BUFFER_TIKTOK_CHANNEL_ID,  label: 'TikTok' },
    YouTube: { id: env.BUFFER_YOUTUBE_CHANNEL_ID, label: 'YouTube' },
  };

  if (!apiKey) { console.error('❌ BUFFER_API_KEY が未設定'); process.exit(1); }

  // 1. SNSドラフト読み込み（今日 or 最新）
  const draftsDir = join(ROOT, 'sns-drafts');
  let draftDate = today;
  if (!existsSync(join(draftsDir, `${today}.md`))) {
    const files = readdirSync(draftsDir)
      .filter(f => f.endsWith('.md')).sort();
    draftDate = files.at(-1)?.replace('.md', '') ?? today;
    console.log(`⚠️  ${today}.md なし → ${draftDate}.md を使用`);
  }
  console.log(`\n📖 ドラフト読み込み: sns-drafts/${draftDate}.md`);
  const posts = parseDraft(draftDate);
  console.log(`   ${posts.length}件の投稿を検出`);

  // 2. Buffer 投稿（X のみ。TikTok・YouTubeはテキストのみ→動画準備後に別途）
  const dueAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30分後
  const logs = [];

  // --index オプションで特定投稿のみ再送可能
  const indexFilter = process.argv[2] ? Number(process.argv[2]) : null;
  const targetPosts = indexFilter
    ? posts.filter((p) => Number(p.index) === indexFilter)
    : posts.slice(0, 3);

  for (const post of targetPosts) { // X投稿（デフォルト3本）
    // X は280文字制限（日本語は1文字=2カウント）— 超過時は自動切り詰め
    let text = post.text;
    const twitterLen = [...text].reduce((n, c) => n + (c.charCodeAt(0) > 0x7F ? 2 : 1), 0);
    if (twitterLen > 280) {
      const lastHash = text.lastIndexOf('#');
      const tags = lastHash > 0 ? '\n' + text.slice(lastHash).trim() : '';
      let trimmed = '';
      let count = 0;
      const maxLen = 274 - [...tags].reduce((n, c) => n + (c.charCodeAt(0) > 0x7F ? 2 : 1), 0);
      for (const c of text.slice(0, lastHash > 0 ? lastHash : text.length)) {
        count += c.charCodeAt(0) > 0x7F ? 2 : 1;
        if (count > maxLen) break;
        trimmed += c;
      }
      text = trimmed.replace(/\s+$/, '') + '…' + tags;
      console.log(`  ⚠️  Twitter ${twitterLen}文字 → 切り詰め`);
    }
    console.log(`\n📤 投稿中: ${post.type}`);
    try {
      const result = await bufferPost({
        apiKey,
        channelId: channels.X.id,
        text,
        dueAt,
      });
      console.log(`✅ 投稿成功: ID=${result.id}, 予定時刻=${result.dueAt}`);
      logs.push(`- X投稿「${post.type}」: ID=${result.id}`);
    } catch (e) {
      console.error(`❌ 投稿失敗: ${e.message}`);
      logs.push(`- X投稿「${post.type}」: ❌ ${e.message}`);
    }
  }

  // 3. 記事 Git プッシュ
  const pushed = gitPush(today);
  if (pushed) logs.push('- GitHub: 記事プッシュ完了 → Cloudflare Pages 自動デプロイ開始');

  // (task-diary は上で記録済み)
  // 4. 動画投稿（YouTube Shorts + TikTok）
  const videoDir = join(ROOT, 'public', 'video');
  const BASE_URL = 'https://tenstrage.pages.dev';
  const videoDueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1時間後

  // 投稿済みファイルを追跡（重複投稿防止）
  const postedLogPath = join(ROOT, 'public', 'video', '.posted.json');
  const postedLog = existsSync(postedLogPath)
    ? JSON.parse(readFileSync(postedLogPath, 'utf8'))
    : [];

  if (existsSync(videoDir)) {
    const videoFiles = readdirSync(videoDir)
      .filter(f => f.endsWith('.mp4') && !postedLog.includes(f));

    if (videoFiles.length > 0) {
      console.log(`\n🎬 動画投稿: ${videoFiles.length}本`);
      for (const videoFile of videoFiles) {
        const videoUrl = `${BASE_URL}/video/${videoFile}`;
        const label = videoFile.replace('.mp4', '').replace(/^\d{8}-/, '');
        for (const [platform, ch] of [['YouTube', channels.YouTube], ['TikTok', channels.TikTok]]) {
          try {
            const isYouTube = platform === 'YouTube';
          const videoText = isYouTube
            ? `東京タクシー転職リアル【${label}】\n\n#タクドラ転職 #Takuzo_taxi #タクゾータクシー`
            : `${label}\n\n#タクドラ転職 #Takuzo_taxi #タクゾータクシー`;
          const assetOverride = { video: { url: videoUrl } };
          const postMetadata = isYouTube
            ? { youtube: { title: `東京タクシー転職リアル【${label}】`, categoryId: '22' } }
            : undefined;
          const result = await bufferPost({ apiKey, channelId: ch.id, text: videoText, dueAt: videoDueAt, assetOverride, postMetadata });
            console.log(`✅ ${platform}「${label}」: ID=${result.id}`);
            logs.push(`- ${platform}「${label}」: ID=${result.id}`);
            if (!postedLog.includes(videoFile)) postedLog.push(videoFile);
            // レートリミット対策
            await new Promise(r => setTimeout(r, 2000));
          } catch (e) {
            console.error(`❌ ${platform}「${label}」失敗: ${e.message}`);
            logs.push(`- ${platform}「${label}」: ❌ ${e.message}`);
          }
        }
      }
    }
    writeFileSync(postedLogPath, JSON.stringify(postedLog, null, 2));
  }

  // 5. task-diary 記録
  logDiary(logs.join('\n'));
  console.log('\n📝 task-diary.md に記録完了');
  console.log('\n🎉 publish.js 完了！');
}

main().catch((e) => {
  console.error('❌ 予期しないエラー:', e);
  process.exit(1);
});
