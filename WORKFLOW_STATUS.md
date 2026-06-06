# Workflow Status — Tenstrage Automation System

**Update Date**: 2026-06-04 JST
**System Status**: ✅ Production Ready

---

## System Architecture

```
毎朝 6:30 タスクスケジューラー
  └─ run-pipeline.bat
       └─ pipeline.js
            ├─ 1. NotebookLM クエリ（5ノート → ルール・トレンド取得）
            │     └─ フォールバック: knowledge/ フォルダ直読み
            ├─ 2. Gemini 2.5 Flash で記事3本生成 → src/content/articles/
            ├─ 3. Gemini 2.5 Flash でSNSドラフト生成 → sns-drafts/YYYYMMDD.md
            └─ 4. publish.js 実行
                  ├─ Git push → Cloudflare Pages 自動デプロイ
                  ├─ Buffer API → X投稿3本（30分後スケジュール）
                  └─ 動画あれば → YouTube/TikTok投稿
```

---

## File Structure

```
C:/Users/wtknt/Documents/tenstrage/
├── scripts/
│   ├── pipeline.js              — 日次自動パイプライン（メイン）
│   ├── publish.js               — Git push + Buffer SNS投稿
│   ├── notebooklm-client.js     — NotebookLM MCP クライアント
│   ├── notebooklm-research.js   — 5ノート一括クエリ → knowledge/ 更新
│   ├── notebooklm-add-sources.js— NotebookLM ソース追加
│   ├── line-export-cleaner.js   — LINE export → ノイズ除去 → NLM upload
│   ├── extract-income-records.js— 写真 → Gemini Vision → 構造化データ
│   └── generate-video.js        — TTS + Remotion 動画生成
├── run-pipeline.bat             — タスクスケジューラー用
├── src/content/articles/        — 生成記事
├── sns-drafts/                  — SNS投稿ドラフト
├── video-scripts/               — 動画台本
├── data/
│   ├── line-exports/            — LINE export 生データ（Git管理外）
│   └── income-records/          — 収入証拠写真（Git管理外）
└── logs/                        — パイプラインログ

C:/Users/wtknt/Documents/iCloudDrive/iCloud~md~obsidian/Tenstrage/
├── .env 2                       — 環境変数（iCloudリネーム済）
└── knowledge/
    ├── industry.md              — 現場情報・給与・GOアプリ（NLM Knowledge）
    ├── trends.md                — SEO・競合・記事ネタ（NLM Research）
    ├── video-sns.md             — YouTube/TikTok/Xアルゴリズム（NLM Video）
    ├── affiliate-cvr.md         — CVR/CTA/E-E-A-T（NLM Affiliate）
    ├── remotion.md              — Remotion動画制作（NLM Remotion）
    └── income-records.md        — 給与明細・営業履歴・年収証明（Gemini Vision抽出）
```

---

## NotebookLM 5-Notebook Architecture

| Notebook | ID | Obsidian Output | 用途 |
|----------|----|--------------------|------|
| Tenstrage-Knowledge | 66be25c2-... | knowledge/industry.md | 現場情報・給与・業界知識 |
| Tenstrage-Research | 322bf765-... | knowledge/trends.md | SEO・競合・トレンド |
| Tenstrage-Video | 3861836f-... | knowledge/video-sns.md | SNSアルゴリズム |
| Tenstrage-Affiliate | 654a7db0-... | knowledge/affiliate-cvr.md | CVR最適化 |
| Tenstrage-Remotion | 9074a16f-... | knowledge/remotion.md | 動画制作知識 |

**更新コマンド**: `node scripts/notebooklm-research.js`

---

## API Keys & Services

| Service | Key Variable | Project | Status |
|---------|-------------|---------|--------|
| Gemini API (Vision/TTS) | GEMINI_API_KEY | gen-lang-client-0049892373 | ✅ 課金有効 |
| Gemini API (Text) | GEMINI_TEXT_API_KEY | gen-lang-client-0049892373 | ✅ 課金有効 |
| Buffer (SNS投稿) | BUFFER_API_KEY | — | ✅ |
| Cloudflare (Analytics) | CLOUDFLARE_API_TOKEN | — | ✅ |
| xAI Grok (Xリサーチ) | XAI_API_KEY | — | ✅ |

---

## Known Issues

### .env iCloud Sync
`.env` がiCloudの競合解決で `.env 2` にリネームされる。
全スクリプトに `.env 2` フォールバック実装済み。

### Gemini Model Deprecation
`gemini-2.0-flash` 廃止 → `gemini-2.5-flash` に更新済み。

### NotebookLM Auth
ブラウザ認証が切れた場合: `setup_auth` で再認証。
Chrome プロファイルロック問題: `notebooklm-client.js` で自動クリーンアップ実装済み。

---

## Completed Milestones

- [x] NotebookLM 5ノート統合・knowledge/ フォルダ構築
- [x] LINE export 処理（198K→144Kメッセージ、10チャンク upload）
- [x] 収入記録写真132枚 → Gemini Vision 抽出完了（給与明細11件・営業履歴97件）
- [x] 全スクリプト .env 2 フォールバック対応
- [x] Gemini 2.5 Flash モデル更新
- [x] Buffer SNS投稿インフラ構築
- [x] Cloudflare Pages デプロイ連携
