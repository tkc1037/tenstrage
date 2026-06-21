# Workflow Status — Tenstrage Publishing System

**Update Date**: 2026-06-04 JST
**Current Status**: Retired legacy automation note. See `C:/Users/wtknt/Documents/TenstrageVault/_shared-ai/PROJECT.md` for the active workflow.

> 2026-06-21 update: The old unattended daily generation flow is no longer the active workflow.
> Article generation must be done interactively with duplicate checks, consistency audit, build verification, commit/push, and public URL confirmation.
> SNS and video publishing require review files and approval flags.

---

## System Architecture

```
Active flow
  ├─ Article: duplicate check → draft/edit → fact/consistency audit → build → commit/push → URL check
  ├─ Site deploy: GitHub main push triggers Cloudflare Pages
  ├─ X: reviews/x/ approval flags → dedicated publishing script only
  └─ Video: video-scripts/ → reviews/video/ approval flags → TTS/render/QA → dedicated publishing script only
```

---

## File Structure

```
C:/Users/wtknt/Documents/tenstrage/
├── scripts/
│   ├── pipeline.js              — 公開前確認 + 記事/生成物のpush
│   ├── publish.js               — articles-only のGit push（SNS投稿なし）
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
| Cloudflare Pages | 不要（GitHub連携） | — | ✅ 自動デプロイ |
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
