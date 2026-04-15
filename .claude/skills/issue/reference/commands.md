# Issue 作成コマンド

Issue 作成時にこのファイルを参照する。

## Issue 作成

### 方法 A: `gh` CLI（ローカル環境）

```bash
gh issue create --title "タイトル" --body "$(cat <<'EOF'
## 概要
...
## 受け入れ条件
- [ ] ...
EOF
)" --label "enhancement"
```

### 方法 B: MCP ツール（GitHub MCP 環境）

IMPORTANT: `body` パラメータには Markdown テキストをそのまま渡す。
- 改行は実際の改行文字を使う。`\n` リテラルや文字列連結で組み立てない
- `"` はそのまま書く。HTML エンティティやエスケープにしない

```
ツール: mcp__github__issue_write
パラメータ:
  method: create
  owner: miyashitaAdacotech
  repo: pr-sideber
  title: "タイトル"
  labels: ["enhancement"]
  body: (Markdown テキストをそのまま渡す)
```

### ラベル選択

ラベルは種別に応じて変更:
- Feature → `enhancement`
- Bug → `bug`
- Task → `task`

### どちらを使うか

- `gh` CLI が利用可能 → 方法 A
- `mcp__github__*` ツールが利用可能 → 方法 B
- 両方利用可能 → 方法 A を優先

## Project への追加と Status 設定

Issue 作成後、必ず Project に追加して Status を設定する。

Project: `@miyashitaAdacotech's untitled project`
- Project ID: `PVT_kwHOD2yevc4BOdb4`
- Status フィールド ID: `PVTSSF_lAHOD2yevc4BOdb4zg9KARE`
- Status オプション ID:
  - `Todo`: `f75ad846`
  - `In Progress`: `47fc9ee4`
  - `Done`: `98236657`

デフォルトは `Todo`。以下を必要な値に置き換えて実行する:

```bash
PROJECT_ID="PVT_kwHOD2yevc4BOdb4"
STATUS_FIELD_ID="PVTSSF_lAHOD2yevc4BOdb4zg9KARE"
STATUS_OPTION_ID="f75ad846"  # Todo (デフォルト)
ISSUE_NUMBER=<作成した Issue 番号>

# 1. Issue の node ID を取得
ISSUE_NODE_ID=$(gh api graphql -f query='{ repository(owner: "miyashitaAdacotech", name: "pr-sideber") { issue(number: '$ISSUE_NUMBER') { id } } }' -q '.data.repository.issue.id')

# 2. Project にアイテムとして追加
ITEM_ID=$(gh api graphql -f query='mutation { addProjectV2ItemById(input: { projectId: "'$PROJECT_ID'", contentId: "'$ISSUE_NODE_ID'" }) { item { id } } }' -q '.data.addProjectV2ItemById.item.id')

# 3. Status を設定
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "'$PROJECT_ID'", itemId: "'$ITEM_ID'", fieldId: "'$STATUS_FIELD_ID'", value: { singleSelectOptionId: "'$STATUS_OPTION_ID'" } }) { projectV2Item { id } } }'
```

### Project / フィールド ID を再取得する方法

Project や Status オプションの ID が変わった場合は以下で確認する:

```bash
# Project 一覧
gh api graphql -f query='{ viewer { projectsV2(first: 10) { nodes { id title } } } }'

# 指定 Project のフィールドとオプション
gh api graphql -f query='{ node(id: "PVT_kwHOD2yevc4BOdb4") { ... on ProjectV2 { fields(first: 20) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } } } } }'
```
