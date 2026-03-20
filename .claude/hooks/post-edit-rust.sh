#!/bin/bash
# PostToolUse hook: Rust ファイル編集後に cargo fmt を実行
# clippy は重いため hook では実行しない。/verify や quality-gate.sh で実行する。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUST_DIR="$PROJECT_ROOT/rust-core"

# 変更されたファイルパスを取得
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Rust ファイル以外はスキップ
case "$FILE_PATH" in
  *.rs) ;;
  *) exit 0 ;;
esac

# rust-core ディレクトリがなければスキップ (まだ初期化前)
if [ ! -f "$RUST_DIR/Cargo.toml" ]; then
  exit 0
fi

# cargo が使えなければスキップ
if ! command -v cargo >/dev/null 2>&1; then
  exit 0
fi

cd "$RUST_DIR"

# cargo fmt のみ (高速)
if cargo fmt 2>&1; then
  echo "[hook] cargo fmt: formatted $FILE_PATH"
else
  echo "[hook] WARNING: cargo fmt failed for $FILE_PATH" >&2
fi
