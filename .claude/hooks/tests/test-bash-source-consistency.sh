#!/bin/bash
# BASH_SOURCE 一貫性テスト (Issue #34)
# RED フェーズ: 既存の $0 が残っているため FAIL することを期待

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/.."

PASS_COUNT=0
FAIL_COUNT=0
ERRORS=()

# --- ヘルパー関数 ---

assert_no_match() {
  local test_name="$1"
  local file="$2"
  local pattern="$3"

  if [ ! -f "$file" ]; then
    echo "  FAIL: $test_name (ファイルが見つかりません: $file)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    ERRORS+=("FAIL: $test_name")
    return
  fi

  if grep -qE "$pattern" "$file"; then
    echo "  FAIL: $test_name (パターン '$pattern' が検出されました)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    ERRORS+=("FAIL: $test_name")
  else
    echo "  PASS: $test_name"
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
}

assert_match() {
  local test_name="$1"
  local file="$2"
  local pattern="$3"

  if [ ! -f "$file" ]; then
    echo "  FAIL: $test_name (ファイルが見つかりません: $file)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    ERRORS+=("FAIL: $test_name")
    return
  fi

  if grep -qE "$pattern" "$file"; then
    echo "  PASS: $test_name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL: $test_name (パターン '$pattern' が見つかりません)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    ERRORS+=("FAIL: $test_name")
  fi
}

# --- 個別ファイルの $0 不在チェック ---

echo "=== post-edit-ts.sh: \$0 が使われていないこと ==="
assert_no_match "01: post-edit-ts.sh に \$0 が存在しない" \
  "$HOOKS_DIR/post-edit-ts.sh" \
  '(^|[^A-Z_])\$\{?0\}?'

echo ""
echo "=== post-edit-rust.sh: \$0 が使われていないこと ==="
assert_no_match "02: post-edit-rust.sh に \$0 が存在しない" \
  "$HOOKS_DIR/post-edit-rust.sh" \
  '(^|[^A-Z_])\$\{?0\}?'

# --- 個別ファイルの BASH_SOURCE 存在チェック ---

echo ""
echo "=== post-edit-ts.sh: BASH_SOURCE が使われていること ==="
assert_match "03: post-edit-ts.sh に \${BASH_SOURCE[0]} が存在する" \
  "$HOOKS_DIR/post-edit-ts.sh" \
  'BASH_SOURCE\[0\]'

echo ""
echo "=== post-edit-rust.sh: BASH_SOURCE が使われていること ==="
assert_match "04: post-edit-rust.sh に \${BASH_SOURCE[0]} が存在する" \
  "$HOOKS_DIR/post-edit-rust.sh" \
  'BASH_SOURCE\[0\]'

# --- 全 .sh ファイルの $0 不在チェック ---

echo ""
echo "=== 全 hooks/*.sh: \$0 が使われていないこと ==="

for sh_file in "$HOOKS_DIR"/*.sh; do
  basename=$(basename "$sh_file")
  # シェバン行にはマッチしないパターンを使用して $0 を検索
  # $0 の使用パターン: "$0", $0, ${0} など
  assert_no_match "05-all: $basename に \$0 が存在しない" \
    "$sh_file" \
    '(^|[^A-Z_])\$\{?0\}?'
done

# --- 結果サマリ ---

echo ""
echo "==============================="
echo "結果: $PASS_COUNT passed, $FAIL_COUNT failed (total $((PASS_COUNT + FAIL_COUNT)))"
echo "==============================="

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "失敗したテスト:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
else
  exit 0
fi
