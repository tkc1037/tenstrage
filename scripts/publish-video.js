#!/usr/bin/env node
import { basename, resolve, join } from 'path';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { parse } from 'yaml';
import { loadEnv, ROOT } from './paths.js';
import { getCodeBlock, getSection, readReview, updateReviewData } from './review/markdown.js';
import { parseMemoryCommands } from './review/memory.js';
import { runVideoQa } from './video/qa.js';
import { validateRemotionSettings } from './video/settings.js';
import { AUDIO_DIR, VIDEO_DIR } from './video/config.js';

const reviewPath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!reviewPath) throw new Error('使い方: node scripts/publish-video.js <動画レビュー.md> [--now]');
const review = readReview(reviewPath);
const memoryCommands = parseMemoryCommands(getCodeBlock(getSection(review.body, '記憶する修正')));
if (memoryCommands.length > 0 && review.data.memoryApplied !== true) {
  throw new Error('恒久修正が未登録です。先に remember-review.js を実行してください');
}
const required = [
  'scriptApproved',
  'audioApproved',
  'visualApproved',
  'factChecked',
  'videoApproved',
  'publishApproved',
];
const missing = required.filter((key) => review.data[key] !== true);
if (missing.length) throw new Error(`未承認: ${missing.join(', ')}`);

const slug = review.data.slug;
const sourcePath = join(ROOT, review.data.source);
const sourceHash = createHash('sha256').update(readFileSync(sourcePath, 'utf8')).digest('hex');
if (sourceHash !== review.data.scriptHash) throw new Error('台本変更後にレビューが更新されていません');
const audioPath = join(AUDIO_DIR, `${slug}.wav`);
const videoPath = join(VIDEO_DIR, `${slug}.mp4`);
if (!existsSync(videoPath)) throw new Error(`動画がありません: ${videoPath}`);
const remotionInput = parse(getCodeBlock(getSection(review.body, 'Remotion設定'))) ?? {};
const { settings, errors: settingsErrors } = validateRemotionSettings(remotionInput);
if (settingsErrors.length) throw new Error(`Remotion設定エラー:\n- ${settingsErrors.join('\n- ')}`);
const hasSegments = Array.isArray(review.data.segmentTimeline) && review.data.segmentTimeline.length > 0;
const qa = await runVideoQa({ audioPath, videoPath, expected: settings, narrationSpeed: hasSegments ? settings.narrationSpeed : 1 });
if (qa.errors.length) throw new Error(qa.errors.join('\n'));

const youtubeTitle = getCodeBlock(getSection(review.body, 'YouTubeタイトル'));
const youtubeText = getCodeBlock(getSection(review.body, 'YouTube本文'));
const tiktokText = getCodeBlock(getSection(review.body, 'TikTok本文'));
if (!youtubeTitle || !youtubeText || !tiktokText) throw new Error('SNS公開文が空です');

const env = loadEnv();
const GITHUB_REPO = 'tkc1037/tenstrage';
let videoUrl;

function deployApprovedVideo() {
  const relativeVideoPath = `public/video/${basename(videoPath)}`;
  let needsCommit = false;
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relativeVideoPath], { cwd: ROOT, stdio: 'ignore' });
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', relativeVideoPath], { cwd: ROOT });
  } catch {
    needsCommit = true;
  }
  if (needsCommit) {
    execFileSync('git', ['add', '--', relativeVideoPath], { cwd: ROOT, stdio: 'inherit' });
    execFileSync(
      'git',
      ['commit', '--only', relativeVideoPath, '-m', `[video] ${slug} approved`],
      { cwd: ROOT, stdio: 'inherit' },
    );
  }
  execFileSync('git', ['push', 'origin', 'main'], { cwd: ROOT, stdio: 'inherit' });
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
  videoUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${commitSha}/${relativeVideoPath}`;
}

async function waitForDeployment() {
  const localMd5 = createHash('md5').update(readFileSync(videoPath)).digest('hex');
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await fetch(`${videoUrl}?review=${Date.now()}`);
    if (response.ok) {
      const remoteMd5 = createHash('md5').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      if (remoteMd5 === localMd5) return;
    }
    if (attempt < 30) await new Promise((resolveWait) => setTimeout(resolveWait, 10000));
  }
  throw new Error('GitHub rawへの承認済み動画反映を確認できませんでした');
}

deployApprovedVideo();
await waitForDeployment();

const query = `mutation($input: CreatePostInput!){createPost(input:$input){... on PostActionSuccess{post{id status dueAt}} ... on MutationError{message}}}`;
async function post(input) {
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.BUFFER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { input } }),
  });
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((error) => error.message).join('; '));
  const result = json.data?.createPost;
  if (result?.message) throw new Error(result.message);
  return result.post;
}
const atArg = process.argv.find((arg) => arg.startsWith('--at='));
const mode = process.argv.includes('--now') ? 'shareNow' : 'customScheduled';
const dueAt = atArg ? new Date(atArg.slice('--at='.length)) : new Date(Date.now() + 30 * 60 * 1000);
if (atArg && Number.isNaN(dueAt.getTime())) throw new Error(`--atの日時が不正です: ${atArg}`);
const schedule = mode === 'shareNow' ? {} : { dueAt: dueAt.toISOString() };
const common = { mode, schedulingType: 'automatic', assets: { video: { url: videoUrl } }, ...schedule };
if (!review.data.youtubePublished) {
  const youtube = await post({
    ...common,
    channelId: env.BUFFER_YOUTUBE_CHANNEL_ID,
    text: youtubeText,
    metadata: { youtube: { title: youtubeTitle, categoryId: '22' } },
  });
  updateReviewData(reviewPath, {
    youtubePublished: true,
    youtubeBufferPostId: youtube.id,
  });
}
if (!review.data.tiktokPublished) {
  const tiktok = await post({
    ...common,
    channelId: env.BUFFER_TIKTOK_CHANNEL_ID,
    text: tiktokText,
  });
  updateReviewData(reviewPath, {
    tiktokPublished: true,
    tiktokBufferPostId: tiktok.id,
  });
}
updateReviewData(reviewPath, {
  status: 'published',
  publishedAt: new Date().toISOString(),
});
console.log(`公開処理完了: ${slug}`);
