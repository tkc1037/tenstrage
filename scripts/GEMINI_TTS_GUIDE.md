# Google AI Studio Gemini Speech Generation ガイド

**コスト**：無料（月間無料枠内）

---

## セットアップ

### 1. Google AI Studio 登録

1. https://aistudio.google.com に アクセス
2. Google アカウントでログイン
3. API キー生成：Settings → API Keys → Create API Key

### 2. 環境変数設定

`.env` に追加：

```bash
GEMINI_API_KEY=your-api-key-here
GEMINI_SPEECH_VOICE=ja-JP-Neural2-B
```

---

## 使用方法

### テキスト→音声変換

```bash
curl -X POST https://generativelanguage.googleapis.com/v1beta/files:generateContent \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "タクシー転職についての説明です。",
    "voice_config": {
      "language_code": "ja-JP",
      "voice_name": "ja-JP-Neural2-B"
    },
    "audio_config": {
      "audio_encoding": "MP3"
    }
  }'
```

### 出力

```json
{
  "audio": {
    "audio_content": "base64-encoded-mp3-data"
  }
}
```

MP3をファイルに保存：

```bash
echo $AUDIO_CONTENT | base64 -d > output.mp3
```

---

## Voice Options（日本語）

| Voice | 特徴 |
|-------|------|
| ja-JP-Neural2-A | 男性・標準 |
| ja-JP-Neural2-B | 男性・力強い |
| ja-JP-Neural2-C | 女性・柔らかい |
| ja-JP-Neural2-D | 女性・明るい |

---

## 無料枠の制限

**月間利用量**：
- テキスト入力：月～～トークン
- 音声出力：月～～時間

※ Google AI Studio の Dashboard で確認

---

## Video Agent 実装例

```javascript
const generateSpeech = async (text, voiceName = "ja-JP-Neural2-B") => {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/files:generateContent", {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_config: {
        language_code: "ja-JP",
        voice_name: voiceName,
      },
      audio_config: {
        audio_encoding: "MP3",
      },
    }),
  });

  const data = await response.json();
  return data.audio.audio_content; // base64
};
```

---

## トラブルシューティング

### エラー：Invalid API Key

→ `.env` の GEMINI_API_KEY を確認

### エラー：Quota exceeded

→ 月間無料枠超過。Google Cloud Console で追加クレジット申請

### 音声品質が悪い

→ voice_name を変更（ja-JP-Neural2-C や D を試す）

---

*最終更新：2026-05-29*
