#!/bin/bash
# SessionStart hook: セッション開始時に開発環境をセットアップ

set -euo pipefail

# ローカル環境ではスキップ (Web 環境のみ実行)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# $HOME/.local/bin を PATH に追加 (gh 等のユーザーローカルバイナリ用)
export PATH="$HOME/.local/bin:$PATH"

# 必須ツールチェイン確認
if ! command -v rustup >/dev/null 2>&1 || ! command -v cargo >/dev/null 2>&1; then
  echo "[session-start] ERROR: Rust toolchain (rustup/cargo) not found"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[session-start] ERROR: pnpm not found"
  exit 1
fi

# GitHub CLI (gh) のインストール (未インストールの場合のみ)
if ! command -v gh >/dev/null 2>&1; then
  echo "[session-start] Installing GitHub CLI (gh)..."
  GH_VERSION="2.65.0"
  GH_TARBALL="/tmp/gh_${GH_VERSION}_linux_amd64.tar.gz"
  GH_DIR="/tmp/gh_${GH_VERSION}_linux_amd64"
  mkdir -p "$HOME/.local/bin"
  curl -sL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" -o "$GH_TARBALL" \
    && tar xzf "$GH_TARBALL" -C /tmp \
    && cp "$GH_DIR/bin/gh" "$HOME/.local/bin/gh" \
    && rm -rf "$GH_TARBALL" "$GH_DIR" \
    && echo "[session-start] gh $(gh --version | head -1) installed" \
    || echo "[session-start] WARN: gh installation failed, continuing"
fi

# cargo-binstall の導入 (未インストールの場合のみ、失敗しても継続)
if ! command -v cargo-binstall >/dev/null 2>&1; then
  echo "[session-start] Installing cargo-binstall..."
  cargo install cargo-binstall || echo "[session-start] WARN: cargo-binstall installation failed, falling back to cargo install"
fi

# Rust 開発ツールのインストール (未インストールの場合のみ、失敗しても継続)
for tool in cargo-machete cargo-audit wasm-pack; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[session-start] Installing $tool..."
    if command -v cargo-binstall >/dev/null 2>&1; then
      cargo binstall -y "$tool" || echo "[session-start] WARN: $tool installation failed, continuing"
    else
      cargo install "$tool" || echo "[session-start] WARN: $tool installation failed, continuing"
    fi
  fi
done

# Node.js 依存のインストール (node_modules が最新ならスキップ)
cd "$PROJECT_ROOT"
if [ ! -d "node_modules" ] || [ "pnpm-lock.yaml" -nt "node_modules/.modules.yaml" ]; then
  echo "[session-start] Installing Node.js dependencies..."
  pnpm install --frozen-lockfile
else
  echo "[session-start] Node.js dependencies up to date, skipping"
fi

# WASM ビルド成果物の生成 (pkg/ がなければビルド、あればスキップ)
WASM_PKG="$PROJECT_ROOT/rust-core/crates/adapter-wasm/pkg"
if [ ! -d "$WASM_PKG" ] || [ ! -f "$WASM_PKG/adapter_wasm.js" ]; then
  echo "[session-start] Building WASM..."
  (cd "$PROJECT_ROOT/rust-core/crates/adapter-wasm" && wasm-pack build --target web --dev)
else
  echo "[session-start] WASM build artifacts exist, skipping"
fi

echo "[session-start] Setup complete!"
