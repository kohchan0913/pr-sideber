# ブロッカー（Blocked-by）API リファレンス

## 前提
- ブロッカー関係は **GraphQL API** (`addBlockedBy` ミューテーション) で設定する。REST API にはこのエンドポイントがない。
- Sub-issue（親子分解）とは意味が異なる。ブロッカーは「この Issue が完了しないと着手できない」という依存関係。
- node ID（GraphQL 用 ID、`I_kwDO...` 形式）が必要。REST API の数値 `id` ではない。

## 利用可否の確認

```bash
gh api graphql -f query='{ __type(name: "Mutation") { fields { name } } }' \
  --jq '.data.__type.fields[].name' | grep -Fx 'addBlockedBy'
```

利用不可の場合は、Issue 本文に依存関係を明記してフォールバックする。

## Issue の node ID 取得

```bash
# 単一
gh api graphql -f query='
  query { repository(owner: "OWNER", name: "REPO") {
    issue(number: N) { id }
  } }
' --jq '.data.repository.issue.id'

# 一括取得 (alias)
gh api graphql -f query='
  query { repository(owner: "OWNER", name: "REPO") {
    i1: issue(number: 1) { id }
    i2: issue(number: 2) { id }
    i3: issue(number: 3) { id }
  } }
' --jq '.data.repository'
```

## ブロッカー設定

`issueId` = ブロックされる側（後に実装）、`blockingIssueId` = ブロックする側（先に実装）:

```bash
gh api graphql -f query='
  mutation {
    addBlockedBy(input: {
      issueId: "後に実装するIssueのnodeID"
      blockingIssueId: "先に実装するIssueのnodeID"
    }) {
      blockingIssue { number }
    }
  }
'
```

複数のブロッカーを一括設定する場合は alias を使う:
```bash
gh api graphql -f query="mutation {
  a1: addBlockedBy(input: {issueId: \"$BLOCKED\", blockingIssueId: \"$BLOCKER1\"}) { blockingIssue { number } }
  a2: addBlockedBy(input: {issueId: \"$BLOCKED\", blockingIssueId: \"$BLOCKER2\"}) { blockingIssue { number } }
}"
```

## ブロッカー解除

```bash
gh api graphql -f query='
  mutation {
    removeBlockedBy(input: {
      issueId: "ブロックされている側のnodeID"
      blockingIssueId: "ブロックしている側のnodeID"
    }) {
      clientMutationId
    }
  }
'
```
