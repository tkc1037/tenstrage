#!/usr/bin/env node
/**
 * post-income-now.js — 年収ビフォーアフター即時投稿
 */
import { OBSIDIAN, loadEnv } from './paths.js';

const env = loadEnv();
const apiKey = env.BUFFER_API_KEY;
const imageUrl = 'https://raw.githubusercontent.com/tkc1037/tenstrage/main/public/images/income-before-after.jpeg';

const QUERY = `
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

async function post(channelId, text, platform, assets = null) {
  const dueAt = new Date(Date.now() + 60 * 1000).toISOString(); // 1分後
  const input = {
    channelId,
    text,
    mode: 'customScheduled',
    schedulingType: 'automatic',
    dueAt,
    ...(assets ? { assets } : {}),
  };
  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY, variables: { input } }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '));
  const result = json.data?.createPost;
  if (result?.message) throw new Error(result.message);
  console.log(`${platform}: ✅ ID=${result?.post?.id}`);
}

// --- 投稿文 ---
const xText = `営業職の年収454万が、タクシー転職したら814万になった。

証拠は住民税の通知書。
年収+360万。これが現実。

#タクシー転職 #年収UP`;

const tiktokText = `年収454万→814万のビフォーアフター
住民税の通知書が全てを物語る

#タクシー転職 #年収UP #転職 #ビフォーアフター`;

const ytText = `【年収+360万】営業職→タクシー転職のリアル
住民税通知書で証明する年収ビフォーアフター

#タクシー転職 #年収UP #Shorts`;

// --- 投稿実行 ---
const twitterLen = [...xText].reduce((n, c) => n + (c.charCodeAt(0) > 0x7F ? 2 : 1), 0);
console.log(`X投稿: ${xText.length}文字 (Twitter換算: ${twitterLen}文字)`);

await post(env.BUFFER_X_CHANNEL_ID, xText, 'X', { image: { url: imageUrl } });
await post(env.BUFFER_TIKTOK_CHANNEL_ID, tiktokText, 'TikTok', { image: { url: imageUrl } });
await post(env.BUFFER_YOUTUBE_CHANNEL_ID, ytText, 'YouTube', { image: { url: imageUrl } });

console.log('\n🎉 全プラットフォーム投稿完了');
