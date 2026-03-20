---
name: review
description: コード変更に対して4専門 agent (セキュリティ・アーキテクチャ・品質・パフォーマンス) を並列起動し統合レビューを返す。「レビューして」「コードチェック」「変更確認」「PR前にチェック」「見てくれ」「LGTM?」などの依頼時に使用する。
---

# コードレビュー

## ワークフロー

IMPORTANT: subagent は別の subagent を起動できない。このスキルは主会話で実行されるため、ここから4 agent を並列起動する。

1. `git diff` で変更を把握する ($ARGUMENTS があればその範囲に限定)
2. 以下の4 agent を **並列で** 起動する:
   - `security-reviewer` — 網羅的セキュリティ監査
   - `architecture-reviewer` — レイヤー境界・責務分担チェック
   - `quality-reviewer` — ロジック品質 (lint 除外)
   - `performance-reviewer` — API 効率・WASM サイズ
3. 4 agent の結果を統合して報告する
4. `/do` スキルからチェーンされた場合: HIGH 以上の指摘件数と詳細を返す (修正ループ判定に使われる)

## 統合レビューの出力形式

```
## レビュー結果: APPROVE / REQUEST_CHANGES / COMMENT

### セキュリティ
(security-reviewer の結果)

### アーキテクチャ
(architecture-reviewer の結果)

### 品質
(quality-reviewer の結果)

### パフォーマンス
(performance-reviewer の結果)

### 総評
```

## プロジェクト固有の注意点

- Svelte コンポーネントから chrome.* API を直接呼んでいないか
- ドメインロジックが TypeScript 側に漏れていないか (Rust/WASM の責務)
- WASM 境界の型に破壊的変更がないか
