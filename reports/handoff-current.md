# Handoff — 記事品質改善（関連記事リンク＋視覚化）

## Objective

`src/content/articles/` 内の全記事に対して以下を実施する：

1. **関連記事テキストをリンク付きに変換**
2. **視覚化：表・箇条書き・コールアウトを追加し文字の羅列を解消**

---

## Current state

- ブランチ: `main`
- 最新コミット: `ddd23f2`
- 記事数: 64ファイル（`src/content/articles/*.md`）
- 公開中の記事: `draft: false` または `draft` フィールドなし（約12本）
- draft:true の記事: 約52本（非公開だが同様に改善する）

---

## Completed（このハンドオフ前に完了済み）

- アフィリエイトリンク44記事を一括修正済み（`a8mat=TENSTRAGE` → `a8mat=4B40F9+FIGOIY+58IO+BXQOH`）
- ドメイン `tenstrage.pages.dev` → `takuzo-taxi.com` に全ファイル更新済み

---

## Unfinished（Codexが実施すること）

### タスク1: 関連記事リンクの付与

記事末尾またはコンテンツ内に「関連記事」セクションがある場合、リンクのないテキストを以下の形式のMarkdownリンクに変換する。

**リンク対象（canonical記事）:**

| 記事名 | URL パス |
|---|---|
| タクシー会社の選び方 | `/articles/taxi-company-selection-guide/` |
| 配車アプリ使い分け完全ガイド / GOアプリ活用ガイド | `/articles/go-app-guide/` |
| 東京タクシー運賃改定2026 | `/articles/20260613-tokyo-taxi-year-income-502/` |
| 入社祝い金返金トラブル完全回避ガイド | `/articles/20260613-signing-bonus-refund-guide/` |
| GO Crewで稼ぐ新しい働き方 | `/articles/20260613-go-crew-new-work-style/` |
| 年収800万円超を実現する秘訣 | `/articles/20260614-800-income-secret-2026/` |
| 二種免許の取り方完全ガイド | `/articles/taxi-type2-license-guide/` |
| 隔日勤務・昼日勤・夜日勤を徹底比較 | `/articles/taxi-shift-comparison/` |
| 40代からのタクシー転職 | `/articles/taxi-career-change-40s/` |
| 転職ロードマップ | `/articles/taxi-career-roadmap/` |
| タクシードライバーの年収と歩合の仕組み | `/articles/taxi-income-commission-guide/` |

**変換例（Before/After）:**

```
# Before（リンクなしテキスト）
関連記事：東京タクシードライバーの年収502万円、タクシー会社の選び方、配車アプリ使い分け完全ガイド

# After（Markdownリンク付き）
**関連記事**
- [東京タクシー運賃改定2026｜改定率10.14%で何が変わったのか](/articles/20260613-tokyo-taxi-year-income-502/)
- [失敗しないタクシー会社の選び方](/articles/taxi-company-selection-guide/)
- [GOアプリ活用ガイド](/articles/go-app-guide/)
```

存在しない記事へのリンクは作らない。上記リストにない記事名はテキストのまま残す。

---

### タスク2: 視覚化（全公開記事を優先、次にdraft記事）

文字の羅列になっている箇所を以下で改善する。

**優先度高（必ず実施）:**
- 比較・数字の羅列 → Markdownテーブルに変換
- 手順・条件の列挙 → 番号付きリスト or チェックリストに変換
- 重要なポイント・注意事項 → blockquote（`>`）またはコールアウト形式に変換

**優先度中（記事に合う場合のみ）:**
- 年収・営収シミュレーション → テーブルで整理
- タイムライン・流れ → 番号付き手順に変換
- メリット・デメリット比較 → 2列テーブルに変換

**禁止事項:**
- 記事の主張・数値・固有名詞を変えない
- frontmatterを変えない（`draft`, `pubDate`, `title` 等）
- アフィリエイトリンク（`px.a8.net`）を変えない
- 外部ソースリンクを変えない
- 新しいコンテンツを創作しない（構造の整理のみ）

---

## 対象ファイル

```
src/content/articles/*.md （64ファイル）
```

公開中を優先して処理し、draft:true は後回しでよい。

---

## Approval required

- コミット・プッシュは1タスク完了ごとに `main` ブランチへ行う
- デプロイは自動（GitHub → Cloudflare Pages）

---

## Known risks

- 64ファイルを一括処理するとコンテキストが溢れる。10〜15ファイルずつバッチ処理すること
- 「関連記事」という文字列がない記事でも、記事末尾のCTAセクション周辺にリンクが必要な場合がある

---

## Next exact action

1. `src/content/articles/` 内の公開記事（`draft: false` または `draft` なし）を特定
2. タスク1（関連記事リンク）→ タスク2（視覚化）の順で各ファイルを処理
3. 処理後 `git add` → `git commit` → `git push origin main`
