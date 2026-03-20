---
paths:
  - "src/**"
  - "rust-core/**"
---

# テストルール

## 方針: TDD (Red-Green-Refactor) を採用

IMPORTANT: テストを先に書く。プロダクションコードの前にテストコードを書くこと。

1. **RED**: テストを書いて失敗を確認する
2. **GREEN**: テストを通す最小限のコードを書く
3. **REFACTOR**: テストが通る状態を維持しながら改善する

## カバレッジ目標
- ドメインロジック (Rust): 90%+
- API クライアント (TypeScript): 80%+
- 全体: 80%+

## Rust テスト
- `cargo test` で実行
- ドメインロジック (状態判定、ソート、DTO 変換) は網羅的にテストする
- テストデータは GraphQL レスポンスの実例をベースにする

## TypeScript テスト
- `pnpm test` で実行
- Chrome API のモックは `src/test/mocks/` に集約する
- Svelte コンポーネントのテストは E2E より単体テスト優先
