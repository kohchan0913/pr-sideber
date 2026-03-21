# Issue 作成コマンド

Issue 作成時にこのファイルを参照する。

## Issue 作成

```bash
gh issue create --title "タイトル" --body "$(cat <<'EOF'
## 概要
...
## 受け入れ条件
- [ ] ...
EOF
)" --label "enhancement"
```

ラベルは種別に応じて変更:
- Feature → `enhancement`
- Bug → `bug`
- Task → `task`
