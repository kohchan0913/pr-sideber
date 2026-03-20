#!/bin/bash
# PostToolUse hook: TypeScript/Svelte ファイル編集後に fmt + lint を実行
# Write/Edit ツール実行後に呼ばれる

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# 変更されたファイルパスを取得
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# TS/Svelte ファイル以外はスキップ
case "$FILE_PATH" in
  *.ts|*.svelte) ;;
  *) exit 0 ;;
esac

# ファイルが存在しなければスキップ
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

cd "$PROJECT_ROOT"

# node_modules がなければスキップ (まだ pnpm install 前)
if [ ! -d "node_modules" ]; then
  exit 0
fi

# Prettier
if pnpm exec prettier --version >/dev/null 2>&1; then
  if pnpm exec prettier --write -- "$FILE_PATH" 2>&1; then
    echo "[hook] prettier: formatted $FILE_PATH"
  else
    echo "[hook] WARNING: prettier failed for $FILE_PATH" >&2
  fi
fi

# ESLint (autofix)
if pnpm exec eslint --version >/dev/null 2>&1; then
  if pnpm exec eslint --fix -- "$FILE_PATH" 2>&1; then
    echo "[hook] eslint: checked $FILE_PATH"
  else
    echo "[hook] WARNING: eslint --fix failed for $FILE_PATH" >&2
  fi
fi
