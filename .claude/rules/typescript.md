---
paths:
  - "src/**/*.ts"
  - "src/**/*.svelte"
  - "*.config.ts"
---

# TypeScript ルール

## スタイル
- ESM (import/export) のみ。require() 禁止
- strict モード必須
- any 型禁止。unknown + 型ガードを使う
- 2スペースインデント

## Chrome Extension 固有
- chrome.* API の呼び出しは `src/background/` または `src/shared/` に集約する
- Side Panel のコンポーネントから直接 chrome.* を呼ばない
- Service Worker はステートレスに保つ。状態は chrome.storage に永続化する

## Svelte 固有
- Svelte 5 の runes ($state, $derived, $effect) を使う
- レガシーな reactive 宣言 ($:) は使わない
- コンポーネントは小さく保つ。100行超えたら分割を検討する

## 型定義
- API レスポンスの型は `src/shared/types/` に定義する
- WASM からの戻り値も TypeScript 側で型定義する
