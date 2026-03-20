# PR 作成 & 報告の手順

Phase 6 に到達したらこのファイルを参照する。

## PR 作成

`.github/pull_request_template.md` に準拠する。

```bash
gh pr create --title "feat: タイトル" --body "$(cat <<'EOF'
## 概要
(Issue の要約 + 何を実装したか)

## 変更内容
- ファイル: 変更内容
- ファイル: 変更内容

## 関連 Issue
- closes #番号

## テスト
- [x] TypeScript 型チェック通過 (`pnpm check`)
- [x] フロントエンドテスト通過 (`pnpm test`)
- [x] Rust lint 通過 (`cargo clippy --all-targets`)
- [x] Rust テスト通過 (`cargo test`)
- [x] `/verify` で検証ループ PASS

## スクリーンショット
(UI 変更がある場合のみ)

## レビュー観点
(レビュアーに特に見てほしいポイント)
EOF
)"
```

## Agent レビューサマリーをコメントに追記

```bash
gh pr comment $PR_NUMBER --body "$(cat <<'EOF'
## Agent レビューサマリー

| 観点 | 結果 | 指摘件数 |
|------|------|---------|
| Security | PASS/FAIL | X 件 |
| Architecture | PASS/FAIL | X 件 |
| Quality | PASS/FAIL | X 件 |
| Performance | PASS/FAIL | X 件 |

**Review iterations:** X 回
**残存指摘:** なし / あれば詳細
EOF
)"
```
