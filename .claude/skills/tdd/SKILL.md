---
name: tdd
description: 指定された機能を TDD (Red-Green-Refactor) で実装する。「機能追加して」「実装して」「作って」「バグ直して」「新しいコンポーネント」「APIクライアント作成」などの開発依頼時に使用する。
---

# TDD 開発

$ARGUMENTS の機能を Red-Green-Refactor で実装する。

IMPORTANT: `implementer` agent を起動して実装を委譲する。以下の情報を agent に渡すこと。

## agent に渡す指示

1. 実装対象: $ARGUMENTS の内容
2. TDD サイクル厳守: テストを先に書く → 失敗確認 → 最小実装 → テスト通過 → リファクタ
3. 以下のエッジケースを考慮する

## プロジェクト固有のエッジケース

PR Sidebar 特有のテストすべきケース:
- レビューが 0 件の PR
- CI が未設定の PR
- Draft かつ Approved な PR
- GraphQL レスポンスの null フィールド
- 100件超の PR リスト

## テスト実行

- TypeScript: `pnpm test`
- Rust: `cd rust-core && cargo test`
- カバレッジ目標: ドメインロジック 90%+、全体 80%+

## 制約

- IMPORTANT: テストが失敗する前にプロダクションコードを書かない
- 各ステップ (RED → GREEN → REFACTOR) の完了を報告してから次に進む
