# Tenstrage Gemini TTS ガイド

_最終更新: 2026-06-09_

## 正本

- 実装: `scripts/generate-video.js`
- モデル: `gemini-2.5-flash-preview-tts`
- 既定音声: `Achird`
- 出力: 24kHz / mono / 16-bit PCMをWAV化
- APIキー読込: `scripts/paths.js` の `loadEnv()`

`.env`:

```dotenv
GEMINI_API_KEY=...
# 任意。未指定時はAchird
GEMINI_TTS_VOICE=Achird
```

## 実行

```powershell
# 確認ファイルを作る
node scripts/video-review.js 20260608-first-introduction.md

# レビュー内のscriptApproved / speechApprovedをtrueにして音声だけ生成
node scripts/generate-video.js 20260608-first-introduction.md --audio-only

# 試聴後にaudioApproved / visualApprovedをtrueにして映像生成
node scripts/generate-video.js 20260608-first-introduction.md --render-only --skip-background
```

確認ファイルはVaultの `reviews/video/` に作成される。承認フラグが不足している場合、生成処理は停止する。

## 実装上の注意

- Gemini TTSの音声データはPCMの場合があるため、WAVヘッダーを付与して保存する。
- YAML frontmatterやMarkdown記号は読み上げ対象から除外する。
- 外部APIはRemotionのレンダリング中に呼ばず、先に音声ファイルを固定する。
- 料金・無料枠は変更され得るため、実行前に公式Pricingで確認する。

## 公式資料

- Speech generation: https://ai.google.dev/gemini-api/docs/speech-generation
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
