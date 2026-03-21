---
name: verify
description: 6フェーズ検証ループ (ビルド→型→lint→テスト→セキュリティ→diff) を実行してPR提出可否を判定する。「PR出していい？」「マージして大丈夫？」「品質チェック」「CI通る？」「検証して」「verify」「リリース前確認」などの依頼時に使用する。
---

# 検証ループ

以下を順番に実行し、各フェーズの PASS/FAIL を報告する。

## 6フェーズ

1. **ビルド**: `cd rust-core/crates/adapter-wasm && wasm-pack build --target web --dev`
2. **型チェック**: `pnpm check` + `cd rust-core && cargo clippy --all-targets -- -D warnings`
3. **Lint**: `pnpm biome ci .` + `pnpm eslint "src/**/*.svelte"` + `cd rust-core && cargo fmt --all -- --check` + `cargo machete` + `cargo audit`
4. **テスト**: `pnpm test` + `cd rust-core && cargo test --workspace` (カバレッジ 80%+)
5. **セキュリティ**: `ghp_`, `gho_`, `client_secret`, `access_token` の grep + `eval()` / `innerHTML` の使用チェック
6. **Diff**: `console.log` 残留、コメントアウトブロック、WASM 境界の破壊的変更

## 出力

```
✓/✗ Build | Types | Lint | Tests | Security | Diff
Status: READY FOR PR / NOT READY (理由)
```
