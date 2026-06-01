# プロンプトキャッシング実装ガイド

**削減効果**：入力コスト最大90%削減

---

## 実装方法

### System Prompt キャッシング

```javascript
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4000,
  system: [
    {
      type: "text",
      text: claudeMdContent, // CLAUDE.md の内容
      cache_control: { type: "ephemeral" },
    },
  ],
  messages: [
    {
      role: "user",
      content: "タスク内容",
    },
  ],
});
```

### ルールファイルキャッシング

```javascript
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4000,
  system: "あなたはタクシー転職コンテンツエージェント",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: writingRulesContent, // quality/writing-rules.md
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: seoRulesContent, // quality/seo-rules.md
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: knowledgeContent, // knowledge.md
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: "実際のタスク：記事を3本生成してください",
        },
      ],
    },
  ],
});
```

---

## キャッシング対象ファイル

| ファイル | 効果 | キャッシュタイプ |
|---------|------|-----------------|
| CLAUDE.md | 毎回読み込みの削減 | system（常駐） |
| quality/writing-rules.md | 記事生成時の重複削減 | ephemeral |
| quality/seo-rules.md | SEO設定時の重複削減 | ephemeral |
| quality/sns-copywriting-rules.md | SNS生成時の重複削減 | ephemeral |
| knowledge.md | 毎回読み込みの削減 | ephemeral（月1更新） |
| feedback/trends.md | トレンド検索時の削減 | ephemeral |

---

## 実装チェックリスト

- [ ] Writer Agent：quality/*.md + knowledge.md をキャッシュ化
- [ ] Publisher Agent：knowledge.md をキャッシュ化
- [ ] Video Agent：台本ルールファイルをキャッシュ化
- [ ] Research Agent：trend.md をキャッシュ化

---

## トークン削減計算

**例）Writer Agent で記事3本生成時：**

キャッシュなし：
- CLAUDE.md：500トークン × 3回 = 1,500トークン
- writing-rules.md：2,000トークン × 3回 = 6,000トークン
- seo-rules.md：2,000トークン × 3回 = 6,000トークン
- 合計入力削減対象：13,500トークン

キャッシュあり（ephemeral）：
- 初回：フル入力
- 2回目以降：キャッシュ活用で 90% 削減
- **月間削減**：約 80,000トークン

---

## 注意点

1. **キャッシュ有効期限**：ephemeral は 5分間有効
2. **コスト**：キャッシュ作成コスト = 通常の 25%（読み取り = 10%）
3. **活用タイミング**：同じファイルを複数回読む時のみ効果的
