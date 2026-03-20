# Git ワークフロー (GitHub Flow)

## ブランチ
- GitHub Flow を採用。main は常にデプロイ可能な状態を保つ
- main からフィーチャーブランチを切る
- フィーチャーブランチは PR 経由で main にマージする
- ブランチ名: `feat/xxx`, `fix/xxx`, `refactor/xxx`

## コミット
- Conventional Commits 形式。prefix は英語、本文は日本語: `feat: PRリストのフィルタ機能を追加`
- 1コミット1論理変更

## コミット前チェック
- TypeScript: 型チェック通ること
- Rust: `cargo clippy` と `cargo test` が通ること
- セキュリティ: シークレットが含まれていないこと
