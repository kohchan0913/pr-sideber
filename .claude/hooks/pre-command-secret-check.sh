#!/bin/bash
# PreToolUse hook: Bash コマンド実行前にシークレット漏洩をチェック
# シークレットがコマンドに含まれていたらブロックする

set -euo pipefail

COMMAND="${TOOL_INPUT_COMMAND:-}"
if [ -z "$COMMAND" ]; then
  exit 0
fi

# シークレット系のパターンを検出
PATTERNS=(
  "client_secret"
  "access_token"
  "GITHUB_TOKEN"
  "GITHUB_OAUTH"
  "ghp_"       # GitHub PAT prefix
  "gho_"       # GitHub OAuth token prefix
)

for pattern in "${PATTERNS[@]}"; do
  if printf '%s' "$COMMAND" | grep -qi "$pattern"; then
    echo "BLOCK: シークレット '$pattern' がコマンドに含まれています。環境変数または chrome.storage を使ってください。" >&2
    exit 2
  fi
done
