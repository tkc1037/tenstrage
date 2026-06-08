export function parseXDraft(filePath, content) {
  const posts = [];
  const blocks = content.matchAll(/### 投稿(\d+)：([^\r\n]+)\r?\n[\s\S]*?本文：\r?\n```\r?\n([\s\S]*?)```/g);
  for (const block of blocks) {
    posts.push({
      source: filePath,
      index: Number(block[1]),
      type: block[2].trim(),
      text: block[3].trim(),
    });
  }
  return posts;
}

export function xWeightedLength(text) {
  return twitterText.parseTweet(text).weightedLength;
}

export function validateXText(text) {
  const errors = [];
  const warnings = [];
  const parsed = twitterText.parseTweet(text);
  const length = parsed.weightedLength;
  if (!text.trim()) errors.push('投稿本文が空です');
  if (!parsed.valid) errors.push(`X文字数超過または不正文字: ${length}/280`);
  if (/\[(記事)?URL\]|TODO|TBD/.test(text)) errors.push('未置換プレースホルダーがあります');
  const hashtags = text.match(/#[^\s#]+/g) ?? [];
  if (hashtags.length > 3) warnings.push(`ハッシュタグが多めです: ${hashtags.length}個`);
  return { length, hashtags, errors, warnings };
}
import twitterText from 'twitter-text';
