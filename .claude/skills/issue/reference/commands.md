# Issue 作成・リレーション設定コマンド

Issue 作成時・リレーション設定時にこのファイルを参照する。

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

## サブ issue の追加 (REST API)

```bash
# 子 issue の数値 ID を取得
CHILD_ID=$(gh api /repos/{owner}/{repo}/issues/$CHILD_NUMBER --jq .id)

# 親 issue にサブ issue として追加
gh api repos/{owner}/{repo}/issues/$PARENT_NUMBER/sub_issues \
  -f sub_issue_id="$CHILD_ID"
```

## タスク分割の手順

1. 親 issue を作成する
2. サブ issue を個別に作成する
3. 各サブ issue を REST API で親にリンクする

## GraphQL を使う場合 (代替)

```bash
# node_id を取得
PARENT_NODE_ID=$(gh api /repos/{owner}/{repo}/issues/$PARENT_NUMBER --jq .node_id)
CHILD_NODE_ID=$(gh api /repos/{owner}/{repo}/issues/$CHILD_NUMBER --jq .node_id)

# サブ issue を追加
gh api graphql \
  -H "GraphQL-Features: sub_issues" \
  -f query="
    mutation {
      addSubIssue(input: {
        issueId: \"$PARENT_NODE_ID\",
        subIssueId: \"$CHILD_NODE_ID\"
      }) {
        issue { number }
        subIssue { number }
      }
    }
  "
```
