# Epic/Issue/Claude Code Web ナビゲーション拡張 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR Sidebar を Epic → Issue → PR / Claude Code Web セッションの統合ナビゲーションハブに拡張する

**Architecture:** 既存の責務分担（TS=API/Chrome、Rust/WASM=データ整形、Svelte=UIのみ）を維持し、3フェーズで段階的に拡張する。Phase 1 で Issue 取得+フラット表示、Phase 2 で Epic ツリー統合、Phase 3 で Claude Code Web 検出を追加する。

**Tech Stack:** TypeScript, Svelte 5, Rust/WASM (wasm-pack), GitHub GraphQL API, Chrome Extension Manifest V3

**Spec:** `docs/superpowers/specs/2026-04-01-epic-issue-navigation-design.md`

---

## ファイル構成

### 新規作成ファイル

| ファイル | 責務 |
|---------|------|
| `rust-core/crates/domain/src/issue.rs` | Issue エンティティ |
| `rust-core/crates/adapter-wasm/src/issue_dto.rs` | IssueItemDto / IssueListDto |
| `rust-core/crates/adapter-wasm/src/issue_parser.rs` | Issue 用 GraphQL レスポンスパーサ |
| `rust-core/crates/usecase/src/issue_process.rs` | Issue ソート処理 |
| `rust-core/crates/domain/src/epic.rs` | Epic ツリーエンティティ |
| `rust-core/crates/adapter-wasm/src/epic_dto.rs` | EpicTreeDto / EpicNodeDto |
| `rust-core/crates/adapter-wasm/src/epic_parser.rs` | Epic 用 GraphQL レスポンスパーサ |
| `rust-core/crates/usecase/src/epic_process.rs` | Epic ツリー構築ロジック |
| `src/domain/ports/issue-processor.port.ts` | Issue 処理ポート型定義 |
| `src/domain/ports/epic-processor.port.ts` | Epic 処理ポート型定義 |
| `src/adapter/github/issue-graphql-client.ts` | Issue 用 GraphQL クライアント |
| `src/adapter/github/epic-graphql-client.ts` | Epic 用 GraphQL クライアント |
| `src/sidepanel/components/IssueItem.svelte` | Issue 個別表示コンポーネント |
| `src/sidepanel/components/IssueSection.svelte` | Issue セクションコンポーネント |
| `src/sidepanel/components/EpicSection.svelte` | Epic ツリーセクション |
| `src/sidepanel/components/TreeNode.svelte` | 再帰ツリーノード |
| `src/sidepanel/components/SessionItem.svelte` | Claude Code Web セッション表示 |
| `src/background/claude-session-watcher.ts` | Claude Code Web タブ監視 |
| `src/shared/types/claude-session.ts` | セッション型定義 |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `rust-core/crates/domain/src/lib.rs` | `pub mod issue;` `pub mod epic;` 追加 |
| `rust-core/crates/adapter-wasm/src/lib.rs` | `processIssues()`, `processEpicTree()` WASM 公開 |
| `rust-core/crates/usecase/src/lib.rs` | `pub mod issue_process;` `pub mod epic_process;` 追加 |
| `rust-core/crates/adapter-wasm/src/lib.rs` | `pub mod issue_dto;` `pub mod issue_parser;` 等追加 |
| `src/shared/types/messages.ts` | `FETCH_ISSUES`, `FETCH_EPIC_TREE` メッセージ追加 |
| `src/background/message-handler.ts` | Issue/Epic ハンドラ追加 |
| `src/background/bootstrap.ts` | Issue/Epic サービス初期化 |
| `src/background/types.ts` | AppServices に Issue/Epic サービス追加 |
| `src/sidepanel/components/MainScreen.svelte` | Issue セクション → Epic ツリー統合 |
| `manifest.config.ts` | host_permissions に `claude.ai/*` 追加 (Phase 3) |

---

## Phase 1: Issue 取得 + フラット表示

### Task 1: Rust — Issue エンティティ

**Files:**
- Create: `rust-core/crates/domain/src/issue.rs`
- Modify: `rust-core/crates/domain/src/lib.rs`

- [ ] **Step 1: Issue エンティティを作成**

```rust
// rust-core/crates/domain/src/issue.rs
use serde::Serialize;

use crate::error::DomainError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    id: String,
    number: u32,
    title: String,
    url: String,
    state: IssueState,
    labels: Vec<Label>,
    assignees: Vec<String>,
    updated_at: String,
    /// 親 Issue（Epic）の番号。Epic に属さない場合は None。
    parent_number: Option<u32>,
    /// 親 Issue（Epic）のタイトル。
    parent_title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IssueState {
    Open,
    Closed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    name: String,
    color: String,
}

impl Issue {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: String,
        number: u32,
        title: String,
        url: String,
        state: IssueState,
        labels: Vec<Label>,
        assignees: Vec<String>,
        updated_at: String,
        parent_number: Option<u32>,
        parent_title: Option<String>,
    ) -> Result<Self, DomainError> {
        if id.trim().is_empty() {
            return Err(DomainError::InvalidField {
                field: "id".to_string(),
                reason: "must not be empty".to_string(),
            });
        }
        if title.trim().is_empty() {
            return Err(DomainError::InvalidField {
                field: "title".to_string(),
                reason: "must not be empty".to_string(),
            });
        }
        Ok(Self {
            id,
            number,
            title,
            url,
            state,
            labels,
            assignees,
            updated_at,
            parent_number,
            parent_title,
        })
    }

    pub fn id(&self) -> &str { &self.id }
    pub fn number(&self) -> u32 { self.number }
    pub fn title(&self) -> &str { &self.title }
    pub fn url(&self) -> &str { &self.url }
    pub fn state(&self) -> &IssueState { &self.state }
    pub fn labels(&self) -> &[Label] { &self.labels }
    pub fn assignees(&self) -> &[String] { &self.assignees }
    pub fn updated_at(&self) -> &str { &self.updated_at }
    pub fn parent_number(&self) -> Option<u32> { self.parent_number }
    pub fn parent_title(&self) -> Option<&str> { self.parent_title.as_deref() }

    pub fn into_parts(
        self,
    ) -> (
        String, u32, String, String, IssueState, Vec<Label>, Vec<String>,
        String, Option<u32>, Option<String>,
    ) {
        (
            self.id, self.number, self.title, self.url, self.state,
            self.labels, self.assignees, self.updated_at,
            self.parent_number, self.parent_title,
        )
    }
}

impl Label {
    pub fn new(name: String, color: String) -> Self {
        Self { name, color }
    }
    pub fn name(&self) -> &str { &self.name }
    pub fn color(&self) -> &str { &self.color }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_valid_issue() -> Issue {
        Issue::new(
            "ISSUE_1".to_string(),
            42,
            "Fix the bug".to_string(),
            "https://github.com/o/r/issues/42".to_string(),
            IssueState::Open,
            vec![Label::new("bug".to_string(), "d73a4a".to_string())],
            vec!["alice".to_string()],
            "2026-03-01T00:00:00Z".to_string(),
            Some(100),
            Some("Epic: CI/CD".to_string()),
        )
        .expect("valid issue")
    }

    #[test]
    fn construction_success() {
        let issue = make_valid_issue();
        assert_eq!(issue.number(), 42);
        assert_eq!(issue.title(), "Fix the bug");
        assert_eq!(issue.parent_number(), Some(100));
    }

    #[test]
    fn empty_id_fails() {
        let result = Issue::new(
            "".to_string(), 1, "title".to_string(),
            "url".to_string(), IssueState::Open, vec![], vec![],
            "2026-01-01T00:00:00Z".to_string(), None, None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn empty_title_fails() {
        let result = Issue::new(
            "ID_1".to_string(), 1, "  ".to_string(),
            "url".to_string(), IssueState::Open, vec![], vec![],
            "2026-01-01T00:00:00Z".to_string(), None, None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn no_parent_is_none() {
        let issue = Issue::new(
            "ID_1".to_string(), 1, "title".to_string(),
            "url".to_string(), IssueState::Open, vec![], vec![],
            "2026-01-01T00:00:00Z".to_string(), None, None,
        )
        .expect("valid");
        assert_eq!(issue.parent_number(), None);
        assert_eq!(issue.parent_title(), None);
    }

    #[test]
    fn into_parts_roundtrip() {
        let issue = make_valid_issue();
        let (id, number, title, ..) = issue.into_parts();
        assert_eq!(id, "ISSUE_1");
        assert_eq!(number, 42);
        assert_eq!(title, "Fix the bug");
    }
}
```

- [ ] **Step 2: lib.rs に `pub mod issue;` を追加**

`rust-core/crates/domain/src/lib.rs` の先頭に追加:
```rust
pub mod issue;
```

- [ ] **Step 3: テスト実行**

Run: `cd rust-core && cargo test -p domain`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add rust-core/crates/domain/src/issue.rs rust-core/crates/domain/src/lib.rs
git commit -m "feat: Issue エンティティをドメイン層に追加"
```

---

### Task 2: Rust — IssueItemDto + パーサ

**Files:**
- Create: `rust-core/crates/adapter-wasm/src/issue_dto.rs`
- Create: `rust-core/crates/adapter-wasm/src/issue_parser.rs`
- Modify: `rust-core/crates/adapter-wasm/src/lib.rs` (mod 宣言のみ)

- [ ] **Step 1: IssueItemDto を作成**

```rust
// rust-core/crates/adapter-wasm/src/issue_dto.rs
use serde::Serialize;
use tsify_next::Tsify;

use domain::issue::{Issue, IssueState, Label};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Tsify)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct IssueItemDto {
    pub id: String,
    pub number: u32,
    pub title: String,
    pub url: String,
    pub state: IssueState,
    pub labels: Vec<LabelDto>,
    pub assignees: Vec<String>,
    pub updated_at: String,
    pub parent_number: Option<u32>,
    pub parent_title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Tsify)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct LabelDto {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Tsify)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct IssueListDto {
    pub items: Vec<IssueItemDto>,
    pub total_count: u32,
}

impl From<Label> for LabelDto {
    fn from(label: Label) -> Self {
        Self {
            name: label.name().to_string(),
            color: label.color().to_string(),
        }
    }
}

impl From<Issue> for IssueItemDto {
    fn from(issue: Issue) -> Self {
        let (id, number, title, url, state, labels, assignees, updated_at, parent_number, parent_title) =
            issue.into_parts();
        Self {
            id,
            number,
            title,
            url,
            state,
            labels: labels.into_iter().map(LabelDto::from).collect(),
            assignees,
            updated_at,
            parent_number,
            parent_title,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::issue::{Issue, IssueState, Label};

    fn make_issue_item() -> IssueItemDto {
        IssueItemDto {
            id: "ISSUE_1".to_string(),
            number: 42,
            title: "Fix bug".to_string(),
            url: "https://github.com/o/r/issues/42".to_string(),
            state: IssueState::Open,
            labels: vec![LabelDto { name: "bug".to_string(), color: "d73a4a".to_string() }],
            assignees: vec!["alice".to_string()],
            updated_at: "2026-03-01T00:00:00Z".to_string(),
            parent_number: Some(100),
            parent_title: Some("Epic: CI/CD".to_string()),
        }
    }

    #[test]
    fn serde_roundtrip() {
        let original = make_issue_item();
        let json = serde_json::to_string(&original).expect("serialize");
        let restored: IssueItemDto = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(original, restored);
    }

    #[test]
    fn camel_case_fields() {
        let item = make_issue_item();
        let json = serde_json::to_string(&item).expect("serialize");
        assert!(json.contains("\"updatedAt\""));
        assert!(json.contains("\"parentNumber\""));
        assert!(json.contains("\"parentTitle\""));
    }

    #[test]
    fn from_issue_entity() {
        let issue = Issue::new(
            "ISSUE_99".to_string(), 99, "Implement feature".to_string(),
            "https://github.com/o/r/issues/99".to_string(),
            IssueState::Open,
            vec![Label::new("feat".to_string(), "0075ca".to_string())],
            vec!["bob".to_string()],
            "2026-03-15T00:00:00Z".to_string(),
            None, None,
        )
        .expect("valid");

        let dto = IssueItemDto::from(issue);
        assert_eq!(dto.number, 99);
        assert_eq!(dto.labels.len(), 1);
        assert_eq!(dto.labels[0].name, "feat");
        assert_eq!(dto.parent_number, None);
    }

    #[test]
    fn issue_list_dto_empty() {
        let list = IssueListDto { items: vec![], total_count: 0 };
        let json = serde_json::to_string(&list).expect("serialize");
        let restored: IssueListDto = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.items.len(), 0);
    }
}
```

- [ ] **Step 2: Issue パーサを作成**

```rust
// rust-core/crates/adapter-wasm/src/issue_parser.rs
use domain::issue::{Issue, IssueState, Label};
use serde::Deserialize;

use crate::error::WasmError;

#[derive(Debug, Deserialize)]
pub struct IssueGraphQLResponse {
    pub data: Option<IssueGraphQLData>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueGraphQLData {
    pub issues: Option<IssueSearchConnection>,
}

#[derive(Debug, Deserialize)]
pub struct IssueSearchConnection {
    pub edges: Vec<IssueEdge>,
}

#[derive(Debug, Deserialize)]
pub struct IssueEdge {
    pub node: Option<IssueNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueNode {
    pub id: String,
    pub number: u32,
    pub title: String,
    pub url: String,
    pub state: String,
    pub labels: Option<LabelConnection>,
    pub assignees: Option<AssigneeConnection>,
    pub updated_at: String,
    pub parent: Option<ParentRef>,
}

#[derive(Debug, Deserialize)]
pub struct LabelConnection {
    pub nodes: Vec<LabelNode>,
}

#[derive(Debug, Deserialize)]
pub struct LabelNode {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct AssigneeConnection {
    pub nodes: Vec<AssigneeNode>,
}

#[derive(Debug, Deserialize)]
pub struct AssigneeNode {
    pub login: String,
}

#[derive(Debug, Deserialize)]
pub struct ParentRef {
    pub number: u32,
    pub title: String,
}

pub fn parse_issue_nodes(raw_json: &str) -> Result<Vec<Issue>, WasmError> {
    let response: IssueGraphQLResponse =
        serde_json::from_str(raw_json).map_err(|e| WasmError::ParseError(e.to_string()))?;

    let data = response
        .data
        .ok_or_else(|| WasmError::ParseError("missing data field".to_string()))?;

    let connection = data
        .issues
        .ok_or_else(|| WasmError::ParseError("missing issues field".to_string()))?;

    let mut issues = Vec::new();
    for edge in connection.edges {
        let Some(node) = edge.node else { continue };

        let state = match node.state.as_str() {
            "OPEN" => IssueState::Open,
            "CLOSED" => IssueState::Closed,
            _ => IssueState::Open,
        };

        let labels = node
            .labels
            .map(|c| c.nodes.into_iter().map(|l| Label::new(l.name, l.color)).collect())
            .unwrap_or_default();

        let assignees = node
            .assignees
            .map(|c| c.nodes.into_iter().map(|a| a.login).collect())
            .unwrap_or_default();

        let (parent_number, parent_title) = match node.parent {
            Some(p) => (Some(p.number), Some(p.title)),
            None => (None, None),
        };

        match Issue::new(
            node.id, node.number, node.title, node.url, state,
            labels, assignees, node.updated_at, parent_number, parent_title,
        ) {
            Ok(issue) => issues.push(issue),
            Err(e) => {
                // 個別の Issue のパースエラーはスキップ（他の Issue は返す）
                web_sys::console::warn_1(&format!("skipping invalid issue: {e}").into());
            }
        }
    }

    Ok(issues)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_issues() {
        let json = r#"{
            "data": {
                "issues": {
                    "edges": [
                        {
                            "node": {
                                "id": "I_1",
                                "number": 42,
                                "title": "Fix bug",
                                "url": "https://github.com/o/r/issues/42",
                                "state": "OPEN",
                                "labels": { "nodes": [{ "name": "bug", "color": "d73a4a" }] },
                                "assignees": { "nodes": [{ "login": "alice" }] },
                                "updatedAt": "2026-03-01T00:00:00Z",
                                "parent": { "number": 100, "title": "Epic CI/CD" }
                            }
                        }
                    ]
                }
            }
        }"#;

        let issues = parse_issue_nodes(json).expect("should parse");
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].number(), 42);
        assert_eq!(issues[0].parent_number(), Some(100));
    }

    #[test]
    fn parse_empty_issues() {
        let json = r#"{ "data": { "issues": { "edges": [] } } }"#;
        let issues = parse_issue_nodes(json).expect("should parse");
        assert!(issues.is_empty());
    }

    #[test]
    fn parse_invalid_json() {
        let result = parse_issue_nodes("not json");
        assert!(result.is_err());
    }

    #[test]
    fn parse_no_parent() {
        let json = r#"{
            "data": {
                "issues": {
                    "edges": [{
                        "node": {
                            "id": "I_2", "number": 10, "title": "Task",
                            "url": "https://github.com/o/r/issues/10",
                            "state": "OPEN",
                            "labels": { "nodes": [] },
                            "assignees": { "nodes": [{ "login": "bob" }] },
                            "updatedAt": "2026-03-01T00:00:00Z",
                            "parent": null
                        }
                    }]
                }
            }
        }"#;

        let issues = parse_issue_nodes(json).expect("should parse");
        assert_eq!(issues[0].parent_number(), None);
    }
}
```

- [ ] **Step 3: lib.rs に mod 宣言を追加**

`rust-core/crates/adapter-wasm/src/lib.rs` の先頭に追加:
```rust
pub mod issue_dto;
pub mod issue_parser;
```

- [ ] **Step 4: テスト実行**

Run: `cd rust-core && cargo test -p adapter-wasm`
Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add rust-core/crates/adapter-wasm/src/issue_dto.rs rust-core/crates/adapter-wasm/src/issue_parser.rs rust-core/crates/adapter-wasm/src/lib.rs
git commit -m "feat: Issue DTO とパーサを adapter-wasm に追加"
```

---

### Task 3: Rust — Issue ソート usecase + WASM 公開

**Files:**
- Create: `rust-core/crates/usecase/src/issue_process.rs`
- Modify: `rust-core/crates/usecase/src/lib.rs`
- Modify: `rust-core/crates/adapter-wasm/src/lib.rs`

- [ ] **Step 1: Issue ソート処理を作成**

```rust
// rust-core/crates/usecase/src/issue_process.rs
use domain::issue::Issue;

/// Issue を updated_at 降順でソートする（既存の PR ソートと同じ方針）。
pub fn sort_issues_by_updated_at_desc(issues: &mut [Issue]) {
    issues.sort_by(|a, b| b.updated_at().cmp(a.updated_at()));
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::issue::{Issue, IssueState};

    fn make_issue(number: u32, updated_at: &str) -> Issue {
        Issue::new(
            format!("I_{number}"), number, format!("Issue {number}"),
            format!("https://github.com/o/r/issues/{number}"),
            IssueState::Open, vec![], vec!["alice".to_string()],
            updated_at.to_string(), None, None,
        )
        .expect("valid")
    }

    #[test]
    fn sorts_by_updated_at_desc() {
        let mut issues = vec![
            make_issue(1, "2026-01-01T00:00:00Z"),
            make_issue(3, "2026-03-01T00:00:00Z"),
            make_issue(2, "2026-02-01T00:00:00Z"),
        ];
        sort_issues_by_updated_at_desc(&mut issues);
        assert_eq!(issues[0].number(), 3);
        assert_eq!(issues[1].number(), 2);
        assert_eq!(issues[2].number(), 1);
    }

    #[test]
    fn empty_slice_is_noop() {
        let mut issues: Vec<Issue> = vec![];
        sort_issues_by_updated_at_desc(&mut issues);
        assert!(issues.is_empty());
    }
}
```

- [ ] **Step 2: usecase/lib.rs に mod 追加**

`rust-core/crates/usecase/src/lib.rs` に追加:
```rust
pub mod issue_process;
```

- [ ] **Step 3: WASM 公開関数を追加**

`rust-core/crates/adapter-wasm/src/lib.rs` に `processIssues` 関数を追加:

```rust
use crate::issue_dto::{IssueItemDto, IssueListDto};

fn to_issue_list_dto(issues: Vec<domain::issue::Issue>) -> IssueListDto {
    let total_count = issues.len() as u32;
    let items = issues.into_iter().map(IssueItemDto::from).collect();
    IssueListDto { items, total_count }
}

/// GraphQL レスポンス JSON を受け取り、ソート済みの Issue リストを返す。
#[wasm_bindgen(js_name = "processIssues")]
pub fn process_issues(raw_json: &str) -> Result<JsValue, JsError> {
    let mut issues =
        issue_parser::parse_issue_nodes(raw_json).map_err(|e| JsError::new(&e.to_string()))?;

    usecase::issue_process::sort_issues_by_updated_at_desc(&mut issues);

    let dto = to_issue_list_dto(issues);
    serde_wasm_bindgen::to_value(&dto).map_err(|e| JsError::new(&e.to_string()))
}
```

- [ ] **Step 4: テスト実行**

Run: `cd rust-core && cargo test`
Expected: 全テスト PASS

- [ ] **Step 5: WASM ビルド**

Run: `cd rust-core/crates/adapter-wasm && wasm-pack build --target web`
Expected: ビルド成功

- [ ] **Step 6: コミット**

```bash
git add rust-core/crates/usecase/src/issue_process.rs rust-core/crates/usecase/src/lib.rs rust-core/crates/adapter-wasm/src/lib.rs
git commit -m "feat: processIssues WASM 関数を追加"
```

---

### Task 4: TypeScript — Issue 型定義 + メッセージ型

**Files:**
- Create: `src/domain/ports/issue-processor.port.ts`
- Modify: `src/shared/types/messages.ts`

- [ ] **Step 1: Issue 処理ポート型を定義**

```typescript
// src/domain/ports/issue-processor.port.ts
export type IssueState = "OPEN" | "CLOSED";

export interface LabelDto {
  readonly name: string;
  readonly color: string;
}

export interface IssueItemDto {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly state: IssueState;
  readonly labels: readonly LabelDto[];
  readonly assignees: readonly string[];
  readonly updatedAt: string;
  readonly parentNumber: number | null;
  readonly parentTitle: string | null;
}

export interface IssueListDto {
  readonly items: readonly IssueItemDto[];
  readonly totalCount: number;
}

export interface IssueProcessorPort {
  processIssues(rawJson: string): IssueListDto | Promise<IssueListDto>;
}
```

- [ ] **Step 2: メッセージ型に FETCH_ISSUES を追加**

`src/shared/types/messages.ts` を修正:

MESSAGE_TYPES 配列に `"FETCH_ISSUES"` を追加。
RequestMap に `FETCH_ISSUES: undefined` を追加。
ResponseDataMap に `FETCH_ISSUES: IssueListDto` を追加（import も追加）。
ERROR_MESSAGES にも `FETCH_ISSUES: "Failed to fetch issues"` を追加（message-handler.ts）。

- [ ] **Step 3: テスト実行**

Run: `pnpm check`
Expected: 型チェック PASS

- [ ] **Step 4: コミット**

```bash
git add src/domain/ports/issue-processor.port.ts src/shared/types/messages.ts
git commit -m "feat: Issue 型定義と FETCH_ISSUES メッセージ型を追加"
```

---

### Task 5: TypeScript — Issue 用 GraphQL クライアント

**Files:**
- Create: `src/adapter/github/issue-graphql-client.ts`
- Create: `src/test/adapter/github/issue-graphql-client.test.ts`

- [ ] **Step 1: テストを先に書く**

```typescript
// src/test/adapter/github/issue-graphql-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IssueGraphQLClient } from "../../../adapter/github/issue-graphql-client";

const TEST_TOKEN = "gho_test_token";

function createMockResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    headers: new Headers(),
  } as Response;
}

describe("IssueGraphQLClient", () => {
  let client: IssueGraphQLClient;
  let mockGetAccessToken: () => Promise<string>;

  beforeEach(() => {
    mockGetAccessToken = vi.fn().mockResolvedValue(TEST_TOKEN);
    client = new IssueGraphQLClient(mockGetAccessToken);
  });

  it("should send GraphQL query with assignee:@me filter", async () => {
    const mockData = {
      data: { issues: { edges: [] } },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData));

    await client.fetchIssues();

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.query).toContain("assignee:@me");
    expect(body.query).toContain("is:issue");
    expect(body.query).toContain("is:open");
  });

  it("should include Authorization header", async () => {
    const mockData = { data: { issues: { edges: [] } } };
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData));

    await client.fetchIssues();

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers).toEqual(
      expect.objectContaining({ Authorization: `Bearer ${TEST_TOKEN}` }),
    );
  });

  it("should return raw JSON string", async () => {
    const mockData = {
      data: {
        issues: {
          edges: [{
            node: {
              id: "I_1", number: 42, title: "Bug",
              url: "https://github.com/o/r/issues/42",
              state: "OPEN", labels: { nodes: [] },
              assignees: { nodes: [{ login: "alice" }] },
              updatedAt: "2026-03-01T00:00:00Z",
              parent: null,
            },
          }],
        },
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData));

    const rawJson = await client.fetchIssues();
    const parsed = JSON.parse(rawJson);
    expect(parsed.data.issues.edges).toHaveLength(1);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `pnpm test -- src/test/adapter/github/issue-graphql-client.test.ts`
Expected: FAIL（ファイルが存在しない）

- [ ] **Step 3: 実装**

```typescript
// src/adapter/github/issue-graphql-client.ts
import { GitHubApiError } from "../../shared/types/errors";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

const ISSUE_QUERY = `
  query($issueQuery: String!) {
    issues: search(query: $issueQuery, type: ISSUE, first: 50) {
      edges {
        node {
          ... on Issue {
            id
            number
            title
            url
            state
            labels(first: 10) { nodes { name color } }
            assignees(first: 5) { nodes { login } }
            updatedAt
            parent { number title }
          }
        }
      }
    }
  }
`;

export class IssueGraphQLClient {
  private readonly getAccessToken: () => Promise<string>;

  constructor(getAccessToken: () => Promise<string>) {
    this.getAccessToken = getAccessToken;
  }

  async fetchIssues(): Promise<string> {
    const token = await this.getAccessToken();

    const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: ISSUE_QUERY,
        variables: {
          issueQuery: "assignee:@me is:issue is:open",
        },
      }),
    });

    if (!response.ok) {
      throw new GitHubApiError(
        `GitHub API error: ${response.status}`,
        response.status,
      );
    }

    const json = await response.json();

    if (json.errors && !json.data) {
      throw new GitHubApiError(
        `GraphQL error: ${json.errors[0]?.message ?? "unknown"}`,
        200,
      );
    }

    return JSON.stringify(json);
  }
}
```

- [ ] **Step 4: テスト実行**

Run: `pnpm test -- src/test/adapter/github/issue-graphql-client.test.ts`
Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/adapter/github/issue-graphql-client.ts src/test/adapter/github/issue-graphql-client.test.ts
git commit -m "feat: Issue 用 GraphQL クライアントを追加"
```

---

### Task 6: TypeScript — Background ハンドラに FETCH_ISSUES を追加

**Files:**
- Modify: `src/background/message-handler.ts`
- Modify: `src/background/types.ts`
- Modify: `src/background/bootstrap.ts`

- [ ] **Step 1: AppServices に issueApi と issueProcessor を追加**

`src/background/types.ts` に追加:
```typescript
import type { IssueGraphQLClient } from "../adapter/github/issue-graphql-client";
import type { IssueProcessorPort } from "../domain/ports/issue-processor.port";

// AppServices の型に追加:
issueApi: IssueGraphQLClient;
issueProcessor: IssueProcessorPort;
```

- [ ] **Step 2: message-handler.ts に FETCH_ISSUES ケースを追加**

`handleMessage` 関数の switch 文内に追加:
```typescript
case "FETCH_ISSUES": {
    const rawJson = await services.issueApi.fetchIssues();
    const result = services.issueProcessor.processIssues(rawJson);
    sendResponse({ ok: true, data: result });
    break;
}
```

`ERROR_MESSAGES` に追加:
```typescript
FETCH_ISSUES: "Failed to fetch issues",
```

`createMessageHandler` の `services` パラメータの Pick に `"issueApi" | "issueProcessor"` を追加。

- [ ] **Step 3: bootstrap.ts でサービスを初期化**

`bootstrap.ts` の `initializeApp` 内で `IssueGraphQLClient` と WASM の `processIssues` を初期化して `AppServices` に渡す。既存の `GitHubGraphQLClient` / `prProcessor` の初期化パターンに従う。

- [ ] **Step 4: ビルド確認**

Run: `pnpm check`
Expected: 型チェック PASS

- [ ] **Step 5: コミット**

```bash
git add src/background/message-handler.ts src/background/types.ts src/background/bootstrap.ts
git commit -m "feat: FETCH_ISSUES メッセージハンドラを background に追加"
```

---

### Task 7: Svelte — IssueItem + IssueSection コンポーネント

**Files:**
- Create: `src/sidepanel/components/IssueItem.svelte`
- Create: `src/sidepanel/components/IssueSection.svelte`

- [ ] **Step 1: IssueItem.svelte を作成**

```svelte
<!-- src/sidepanel/components/IssueItem.svelte -->
<script lang="ts">
  import type { IssueItemDto } from "../../domain/ports/issue-processor.port";

  type Props = {
    issue: IssueItemDto;
    isActive?: boolean;
    onNavigate?: (url: string) => void;
  };

  const { issue, isActive = false, onNavigate }: Props = $props();

  function handleClick(event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    onNavigate?.(issue.url);
  }
</script>

<a
  href={issue.url}
  class="issue-item"
  class:active={isActive}
  onclick={handleClick}
>
  <div class="issue-title">
    <span class="issue-icon">📋</span>
    <span class="title-text">{issue.title}</span>
    <span class="issue-number">#{issue.number}</span>
  </div>
  <div class="issue-meta">
    {#each issue.labels as label}
      <span
        class="label-badge"
        style="background-color: #{label.color};"
      >{label.name}</span>
    {/each}
  </div>
</a>

<style>
  .issue-item {
    display: block;
    padding: 0.5rem 0.75rem;
    text-decoration: none;
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border-primary);
    transition: background 0.15s;
  }

  .issue-item:hover {
    background: var(--color-bg-secondary);
  }

  .issue-item.active {
    background: var(--color-bg-active);
    border-left: 2px solid var(--color-accent-primary);
  }

  .issue-title {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .issue-icon {
    flex-shrink: 0;
  }

  .title-text {
    color: var(--color-accent-primary);
  }

  .issue-number {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .issue-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.25rem;
    padding-left: 1.25rem;
  }

  .label-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 999px;
    color: white;
    font-weight: 600;
  }
</style>
```

- [ ] **Step 2: IssueSection.svelte を作成**

```svelte
<!-- src/sidepanel/components/IssueSection.svelte -->
<script lang="ts">
  import type { IssueItemDto } from "../../domain/ports/issue-processor.port";
  import IssueItem from "./IssueItem.svelte";

  type Props = {
    title: string;
    items: readonly IssueItemDto[];
    isOpen?: boolean;
    activeTabUrl?: string | null;
    onNavigate?: (url: string) => void;
  };

  const { title, items, isOpen: initialOpen = true, activeTabUrl, onNavigate }: Props = $props();

  let open = $state(initialOpen);

  function toggle(): void {
    open = !open;
  }
</script>

<section>
  <button class="section-header" onclick={toggle}>
    <span class="toggle">{open ? "▼" : "▶"}</span>
    <span class="section-title">{title}</span>
    <span class="count">{items.length}</span>
  </button>

  {#if open}
    {#if items.length === 0}
      <p class="empty">Issue がありません</p>
    {:else}
      {#each items as issue (issue.id)}
        <IssueItem
          {issue}
          isActive={activeTabUrl?.includes(`/issues/${issue.number}`) ?? false}
          {onNavigate}
        />
      {/each}
    {/if}
  {/if}
</section>

<style>
  .section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .toggle {
    font-size: 0.625rem;
    width: 1rem;
  }

  .count {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background: var(--color-bg-secondary);
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
  }

  .empty {
    padding: 0.5rem 0.75rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-style: italic;
  }
</style>
```

- [ ] **Step 3: ビルド確認**

Run: `pnpm check`
Expected: 型チェック PASS

- [ ] **Step 4: コミット**

```bash
git add src/sidepanel/components/IssueItem.svelte src/sidepanel/components/IssueSection.svelte
git commit -m "feat: IssueItem / IssueSection コンポーネントを追加"
```

---

### Task 8: Svelte — MainScreen に Issue セクションを統合

**Files:**
- Modify: `src/sidepanel/components/MainScreen.svelte`

- [ ] **Step 1: MainScreen に Issue 取得 + 表示を追加**

`MainScreen.svelte` の Props に追加:
```typescript
fetchIssues: () => Promise<IssueListDto>;
```

import を追加:
```typescript
import type { IssueListDto } from "../../domain/ports/issue-processor.port";
import IssueSection from "./IssueSection.svelte";
```

state を追加:
```typescript
let issueData = $state<IssueListDto | null>(null);
let issueError = $state<string | null>(null);
```

初期ロードの `$effect` 内で Issue も取得:
```typescript
try {
    const issues = await fetchIssues();
    if (!cancelled) {
        issueData = issues;
    }
} catch (e: unknown) {
    if (!cancelled) {
        issueError = e instanceof Error ? e.message : "Failed to fetch issues";
    }
}
```

テンプレートの `{:else if data}` ブロック内、PrSection の間に追加:
```svelte
<PrSection title="My PRs" items={data.myPrs.items} {onNavigate} {activeTabUrl} />
{#if issueError}
    <div class="error-banner"><p class="error-text">{issueError}</p></div>
{/if}
<IssueSection title="My Issues" items={issueData?.items ?? []} {onNavigate} {activeTabUrl} />
<PrSection title="Review Requests" items={data.reviewRequests.items} {onNavigate} {activeTabUrl} />
```

- [ ] **Step 2: ビルド確認**

Run: `pnpm check && pnpm build`（環境変数付き）
Expected: 全 PASS

- [ ] **Step 3: コミット**

```bash
git add src/sidepanel/components/MainScreen.svelte
git commit -m "feat: MainScreen に My Issues セクションを統合"
```

---

## Phase 2: Epic グルーピング + ツリー構造化

### Task 9: Rust — Epic ツリーエンティティ

**Files:**
- Create: `rust-core/crates/domain/src/epic.rs`
- Modify: `rust-core/crates/domain/src/lib.rs`

- [ ] **Step 1: Epic ツリーノード型を作成**

```rust
// rust-core/crates/domain/src/epic.rs
use serde::Serialize;

/// ツリーのインデント上限。4階層目以降はこの深さで表示する。
pub const MAX_INDENT_DEPTH: u32 = 3;

/// ツリーノードの種別。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum TreeNodeKind {
    Epic { number: u32, title: String },
    Issue { number: u32, title: String, url: String, state: String, labels: Vec<TreeLabel> },
    PullRequest { number: u32, title: String, url: String, pr_data: TreePrData },
    Session { title: String, url: String, issue_number: u32 },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeLabel {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreePrData {
    pub additions: u32,
    pub deletions: u32,
    pub ci_status: String,
    pub approval_status: String,
    pub mergeable_status: String,
    pub is_draft: bool,
    pub size_label: String,
    pub unresolved_comment_count: u32,
}

/// ツリーの1ノード。子ノードを再帰的に持つ。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub kind: TreeNodeKind,
    pub children: Vec<TreeNode>,
    /// 実際のネスト深さ。表示時のインデントは min(depth, MAX_INDENT_DEPTH) で計算。
    pub depth: u32,
}

impl TreeNode {
    pub fn new(kind: TreeNodeKind, depth: u32) -> Self {
        Self { kind, children: vec![], depth }
    }

    pub fn display_depth(&self) -> u32 {
        self.depth.min(MAX_INDENT_DEPTH)
    }

    pub fn add_child(&mut self, child: TreeNode) {
        self.children.push(child);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_depth_within_limit() {
        let node = TreeNode::new(
            TreeNodeKind::Epic { number: 1, title: "Epic".to_string() },
            2,
        );
        assert_eq!(node.display_depth(), 2);
    }

    #[test]
    fn display_depth_capped_at_max() {
        let node = TreeNode::new(
            TreeNodeKind::Issue {
                number: 1, title: "Deep".to_string(),
                url: "url".to_string(), state: "OPEN".to_string(),
                labels: vec![],
            },
            5,
        );
        assert_eq!(node.display_depth(), MAX_INDENT_DEPTH);
    }

    #[test]
    fn add_children() {
        let mut parent = TreeNode::new(
            TreeNodeKind::Epic { number: 1, title: "Epic".to_string() },
            0,
        );
        let child = TreeNode::new(
            TreeNodeKind::Issue {
                number: 2, title: "Issue".to_string(),
                url: "url".to_string(), state: "OPEN".to_string(),
                labels: vec![],
            },
            1,
        );
        parent.add_child(child);
        assert_eq!(parent.children.len(), 1);
    }
}
```

- [ ] **Step 2: lib.rs に `pub mod epic;` を追加**

- [ ] **Step 3: テスト実行**

Run: `cd rust-core && cargo test -p domain`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add rust-core/crates/domain/src/epic.rs rust-core/crates/domain/src/lib.rs
git commit -m "feat: Epic ツリーノード型をドメイン層に追加"
```

---

### Task 10: Rust — Epic ツリー構築 usecase

**Files:**
- Create: `rust-core/crates/usecase/src/epic_process.rs`
- Modify: `rust-core/crates/usecase/src/lib.rs`

- [ ] **Step 1: Epic ツリー構築ロジックを作成**

`processEpicTree` は以下を行う:
1. Issue リストから `parent_number` でグルーピング
2. PR リストを、対応する Issue の子に配置（PR の `closingIssuesReferences` や同番号で紐づけ）
3. Epic に属さない Issue/PR は「Epic なし」(number=0) グループに格納
4. 各 Epic 内を `updated_at` 降順でソート

テスト駆動で実装する。テストケース:
- Epic あり: Issue が親を持つ場合のグルーピング
- Epic なし: parent が null の Issue は「Epic なし」に分類
- 空リスト
- 深いネスト（depth が MAX_INDENT_DEPTH を超えるケース）

```rust
// rust-core/crates/usecase/src/epic_process.rs
use std::collections::HashMap;

use domain::epic::{TreeNode, TreeNodeKind, TreeLabel, TreePrData, MAX_INDENT_DEPTH};
use domain::issue::Issue;
use domain::entity::PullRequest;
use domain::status::{ApprovalStatus, CiStatus, MergeableStatus};

use crate::determine::determine_pr_size;

/// Epic ツリーを構築する。
/// 
/// 返り値は Epic ノードのリスト。Epic に属さない項目は number=0 の「Epic なし」ノードに格納。
pub fn build_epic_tree(issues: Vec<Issue>, prs: Vec<PullRequest>) -> Vec<TreeNode> {
    // Epic (parent_number) → 子 Issue のマップ
    let mut epic_map: HashMap<u32, (String, Vec<Issue>)> = HashMap::new();
    let mut no_epic_issues: Vec<Issue> = Vec::new();

    for issue in issues {
        match (issue.parent_number(), issue.parent_title()) {
            (Some(parent_num), Some(parent_title)) => {
                epic_map
                    .entry(parent_num)
                    .or_insert_with(|| (parent_title.to_string(), Vec::new()))
                    .1
                    .push(issue);
            }
            _ => no_epic_issues.push(issue),
        }
    }

    let mut result: Vec<TreeNode> = Vec::new();

    // Epic ごとにツリーノードを構築
    let mut epic_entries: Vec<(u32, String, Vec<Issue>)> = epic_map
        .into_iter()
        .map(|(num, (title, issues))| (num, title, issues))
        .collect();
    // Epic を番号順でソート（安定した表示順）
    epic_entries.sort_by_key(|(num, _, _)| *num);

    for (epic_number, epic_title, mut epic_issues) in epic_entries {
        let mut epic_node = TreeNode::new(
            TreeNodeKind::Epic { number: epic_number, title: epic_title },
            0,
        );

        // Issue を updated_at 降順でソート
        epic_issues.sort_by(|a, b| b.updated_at().cmp(a.updated_at()));

        for issue in epic_issues {
            let issue_number = issue.number();
            let issue_url = issue.url().to_string();
            let issue_labels: Vec<TreeLabel> = issue
                .labels()
                .iter()
                .map(|l| TreeLabel { name: l.name().to_string(), color: l.color().to_string() })
                .collect();

            let mut issue_node = TreeNode::new(
                TreeNodeKind::Issue {
                    number: issue.number(),
                    title: issue.title().to_string(),
                    url: issue_url,
                    state: format!("{:?}", issue.state()).to_uppercase(),
                    labels: issue_labels,
                },
                1,
            );

            // この Issue に紐づく PR を子に追加
            // PR の URL から Issue 番号を推測するのは困難なので、
            // 同じリポジトリ内の PR で closing reference を持つものを紐づける
            // → Phase 2 の MVP では PR は全て「Epic なし」に入れる。
            //   Issue-PR 紐づけは GraphQL の closingIssuesReferences で後から改善可能。

            epic_node.add_child(issue_node);
        }

        result.push(epic_node);
    }

    // Epic なしグループ
    if !no_epic_issues.is_empty() || !prs.is_empty() {
        let mut no_epic_node = TreeNode::new(
            TreeNodeKind::Epic { number: 0, title: "Epic なし".to_string() },
            0,
        );

        no_epic_issues.sort_by(|a, b| b.updated_at().cmp(a.updated_at()));

        for issue in no_epic_issues {
            let issue_labels: Vec<TreeLabel> = issue
                .labels()
                .iter()
                .map(|l| TreeLabel { name: l.name().to_string(), color: l.color().to_string() })
                .collect();

            let issue_node = TreeNode::new(
                TreeNodeKind::Issue {
                    number: issue.number(),
                    title: issue.title().to_string(),
                    url: issue.url().to_string(),
                    state: format!("{:?}", issue.state()).to_uppercase(),
                    labels: issue_labels,
                },
                1,
            );
            no_epic_node.add_child(issue_node);
        }

        // PR を「Epic なし」に追加
        for pr in prs {
            let (id, number, title, _author, url, _repo, is_draft, approval, ci, mergeable, additions, deletions, _created, _updated, unresolved) = pr.into_parts();
            let pr_node = TreeNode::new(
                TreeNodeKind::PullRequest {
                    number,
                    title,
                    url,
                    pr_data: TreePrData {
                        additions,
                        deletions,
                        ci_status: format!("{ci:?}"),
                        approval_status: format!("{approval:?}"),
                        mergeable_status: format!("{mergeable:?}"),
                        is_draft,
                        size_label: determine_pr_size(additions, deletions).as_label().to_string(),
                        unresolved_comment_count: unresolved,
                    },
                },
                1,
            );
            no_epic_node.add_child(pr_node);
        }

        result.push(no_epic_node);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::issue::{Issue, IssueState, Label};
    use domain::entity::PullRequest;
    use domain::status::{ApprovalStatus, CiStatus, MergeableStatus};

    fn make_issue(number: u32, parent_number: Option<u32>, parent_title: Option<&str>) -> Issue {
        Issue::new(
            format!("I_{number}"), number, format!("Issue {number}"),
            format!("https://github.com/o/r/issues/{number}"),
            IssueState::Open,
            vec![],
            vec!["alice".to_string()],
            format!("2026-03-{:02}T00:00:00Z", number.min(28)),
            parent_number,
            parent_title.map(|s| s.to_string()),
        )
        .expect("valid")
    }

    fn make_pr(number: u32) -> PullRequest {
        PullRequest::new(
            format!("PR_{number}"), number, format!("PR {number}"),
            "author".to_string(),
            format!("https://github.com/o/r/pull/{number}"),
            "o/r".to_string(), false,
            ApprovalStatus::Approved, CiStatus::Passed, MergeableStatus::Unknown,
            10, 5,
            "2026-03-01T00:00:00Z".to_string(),
            "2026-03-02T00:00:00Z".to_string(),
            0,
        )
        .expect("valid")
    }

    #[test]
    fn groups_by_epic() {
        let issues = vec![
            make_issue(1, Some(100), Some("Epic A")),
            make_issue(2, Some(100), Some("Epic A")),
            make_issue(3, Some(200), Some("Epic B")),
        ];
        let tree = build_epic_tree(issues, vec![]);
        assert_eq!(tree.len(), 2); // Epic A, Epic B
        assert_eq!(tree[0].children.len(), 2); // Epic 100 has 2 issues
        assert_eq!(tree[1].children.len(), 1); // Epic 200 has 1 issue
    }

    #[test]
    fn no_epic_group() {
        let issues = vec![make_issue(1, None, None)];
        let prs = vec![make_pr(10)];
        let tree = build_epic_tree(issues, prs);
        assert_eq!(tree.len(), 1); // "Epic なし" only
        assert_eq!(tree[0].children.len(), 2); // 1 issue + 1 PR
    }

    #[test]
    fn empty_input() {
        let tree = build_epic_tree(vec![], vec![]);
        assert!(tree.is_empty());
    }

    #[test]
    fn mixed_epic_and_no_epic() {
        let issues = vec![
            make_issue(1, Some(100), Some("Epic")),
            make_issue(2, None, None),
        ];
        let tree = build_epic_tree(issues, vec![]);
        assert_eq!(tree.len(), 2); // Epic + "Epic なし"
    }

    #[test]
    fn display_depth_capped() {
        // TreeNode の display_depth テストは domain 側で実施済み
        // ここでは build_epic_tree が depth=0, 1 を正しく設定することを確認
        let issues = vec![make_issue(1, Some(100), Some("Epic"))];
        let tree = build_epic_tree(issues, vec![]);
        assert_eq!(tree[0].depth, 0); // Epic depth
        assert_eq!(tree[0].children[0].depth, 1); // Issue depth
    }
}
```

- [ ] **Step 2: usecase/lib.rs に mod 追加**

- [ ] **Step 3: テスト実行**

Run: `cd rust-core && cargo test -p usecase`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add rust-core/crates/usecase/src/epic_process.rs rust-core/crates/usecase/src/lib.rs
git commit -m "feat: Epic ツリー構築ロジックを usecase に追加"
```

---

### Task 11: Rust — EpicTreeDto + WASM 公開

**Files:**
- Create: `rust-core/crates/adapter-wasm/src/epic_dto.rs`
- Modify: `rust-core/crates/adapter-wasm/src/lib.rs`

- [ ] **Step 1: EpicTreeDto を作成**

```rust
// rust-core/crates/adapter-wasm/src/epic_dto.rs
use serde::Serialize;
use tsify_next::Tsify;

use domain::epic::TreeNode;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Tsify)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct EpicTreeDto {
    pub roots: Vec<TreeNode>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::epic::{TreeNode, TreeNodeKind};

    #[test]
    fn serde_roundtrip() {
        let dto = EpicTreeDto {
            roots: vec![TreeNode::new(
                TreeNodeKind::Epic { number: 1, title: "Epic".to_string() },
                0,
            )],
        };
        let json = serde_json::to_string(&dto).expect("serialize");
        assert!(json.contains("\"roots\""));
    }
}
```

- [ ] **Step 2: WASM 公開関数 processEpicTree を追加**

`rust-core/crates/adapter-wasm/src/lib.rs` に追加:

```rust
pub mod epic_dto;

use crate::epic_dto::EpicTreeDto;

/// Issue + PR の JSON を受け取り、Epic ツリーを返す。
#[wasm_bindgen(js_name = "processEpicTree")]
pub fn process_epic_tree(issues_json: &str, prs_json: &str) -> Result<JsValue, JsError> {
    let issues =
        issue_parser::parse_issue_nodes(issues_json).map_err(|e| JsError::new(&e.to_string()))?;

    let parsed_prs =
        parser::parse_pull_request_nodes(prs_json).map_err(|e| JsError::new(&e.to_string()))?;

    let all_prs = {
        let processed = usecase::process::process_pull_requests(parsed_prs.my_prs, parsed_prs.review_requests);
        processed.my_prs
    };

    let tree = usecase::epic_process::build_epic_tree(issues, all_prs);

    let dto = EpicTreeDto { roots: tree };
    serde_wasm_bindgen::to_value(&dto).map_err(|e| JsError::new(&e.to_string()))
}
```

- [ ] **Step 3: テスト実行 + WASM ビルド**

Run: `cd rust-core && cargo test && cd crates/adapter-wasm && wasm-pack build --target web`
Expected: 全 PASS + ビルド成功

- [ ] **Step 4: コミット**

```bash
git add rust-core/crates/adapter-wasm/src/epic_dto.rs rust-core/crates/adapter-wasm/src/lib.rs
git commit -m "feat: processEpicTree WASM 関数を追加"
```

---

### Task 12: TypeScript — Epic 型定義 + メッセージ型

**Files:**
- Create: `src/domain/ports/epic-processor.port.ts`
- Modify: `src/shared/types/messages.ts`

- [ ] **Step 1: Epic 型定義を作成**

```typescript
// src/domain/ports/epic-processor.port.ts
export interface TreeLabel {
  readonly name: string;
  readonly color: string;
}

export interface TreePrData {
  readonly additions: number;
  readonly deletions: number;
  readonly ciStatus: string;
  readonly approvalStatus: string;
  readonly mergeableStatus: string;
  readonly isDraft: boolean;
  readonly sizeLabel: string;
  readonly unresolvedCommentCount: number;
}

export type TreeNodeKind =
  | { readonly type: "epic"; readonly number: number; readonly title: string }
  | { readonly type: "issue"; readonly number: number; readonly title: string; readonly url: string; readonly state: string; readonly labels: readonly TreeLabel[] }
  | { readonly type: "pullRequest"; readonly number: number; readonly title: string; readonly url: string; readonly prData: TreePrData }
  | { readonly type: "session"; readonly title: string; readonly url: string; readonly issueNumber: number };

export interface TreeNodeDto {
  readonly kind: TreeNodeKind;
  readonly children: readonly TreeNodeDto[];
  readonly depth: number;
}

export interface EpicTreeDto {
  readonly roots: readonly TreeNodeDto[];
}

export interface EpicProcessorPort {
  processEpicTree(issuesJson: string, prsJson: string): EpicTreeDto | Promise<EpicTreeDto>;
}
```

- [ ] **Step 2: FETCH_EPIC_TREE メッセージを追加**

`src/shared/types/messages.ts` に `FETCH_EPIC_TREE` を追加（RequestMap: undefined、ResponseDataMap: EpicTreeDto）。

- [ ] **Step 3: コミット**

```bash
git add src/domain/ports/epic-processor.port.ts src/shared/types/messages.ts
git commit -m "feat: Epic ツリー型定義と FETCH_EPIC_TREE メッセージ型を追加"
```

---

### Task 13: Svelte — TreeNode + EpicSection コンポーネント

**Files:**
- Create: `src/sidepanel/components/TreeNode.svelte`
- Create: `src/sidepanel/components/EpicSection.svelte`

- [ ] **Step 1: TreeNode.svelte を作成**

再帰コンポーネント。`TreeNodeDto` を受け取り、kind に応じてアイコン・スタイルを切り替える。children があれば自身を再帰呼び出し。折りたたみ/展開対応。`MAX_INDENT_DEPTH`(=3) を超える depth は `↳` で表示。

- [ ] **Step 2: EpicSection.svelte を作成**

`EpicTreeDto` の `roots` を受け取り、各 root を `TreeNode` でレンダリング。Review Requests セクションは別途 PrSection で表示する。

- [ ] **Step 3: MainScreen を修正**

Phase 2 では `My PRs` + `My Issues` セクションを `EpicSection` に置き換える。`Review Requests` は独立セクションとして維持。

Props に `fetchEpicTree` を追加し、`FETCH_EPIC_TREE` メッセージで取得。

- [ ] **Step 4: ナビゲーション強化**

TreeNode のクリックハンドラで:
1. `chrome.tabs.query()` で URL が一致するタブを検索
2. 見つかったら `chrome.tabs.update(tabId, { active: true })` でフォーカス
3. なければ `chrome.tabs.create({ url })` で新規タブ

既存の `tabNavigation` サービスの `findExistingPrTab` / `activateTab` パターンを拡張して Issue / Session URL にも対応する。

- [ ] **Step 5: ビルド + テスト**

Run: `pnpm check && pnpm test && GITHUB_CLIENT_ID=Ov23liCgU4UCzg03tnCK pnpm exec vite build`
Expected: 全 PASS

- [ ] **Step 6: コミット**

```bash
git add src/sidepanel/components/TreeNode.svelte src/sidepanel/components/EpicSection.svelte src/sidepanel/components/MainScreen.svelte
git commit -m "feat: Epic ツリー表示で My PRs + My Issues を統合"
```

---

## Phase 3: Claude Code Web 検出 + セッション表示

### Task 14: manifest + 型定義

**Files:**
- Modify: `manifest.config.ts`
- Create: `src/shared/types/claude-session.ts`

- [ ] **Step 1: host_permissions に claude.ai を追加**

`manifest.config.ts` の `host_permissions` に `"https://claude.ai/*"` を追加。

- [ ] **Step 2: セッション型を定義**

```typescript
// src/shared/types/claude-session.ts
export interface ClaudeSession {
  readonly sessionUrl: string;
  readonly title: string;
  readonly issueNumber: number;
  readonly detectedAt: string;
  readonly isLive: boolean;
}

export interface ClaudeSessionStorage {
  /** key: issue番号の文字列, value: セッションリスト */
  readonly [issueNumber: string]: readonly ClaudeSession[];
}
```

- [ ] **Step 3: コミット**

```bash
git add manifest.config.ts src/shared/types/claude-session.ts
git commit -m "feat: Claude Code Web セッション型定義と manifest 権限追加"
```

---

### Task 15: Background — Claude Code Web タブ監視

**Files:**
- Create: `src/background/claude-session-watcher.ts`
- Create: `src/test/background/claude-session-watcher.test.ts`

- [ ] **Step 1: テストを先に書く**

Issue 番号抽出の正規表現テスト:
- `"Inv #1882 [#1613] CI/CD App統一"` → issueNumber: 1882
- `"Investigate issue 2185"` → issueNumber: 2185
- `"Investigate Issue 1325"` → issueNumber: 1325
- `"Plan model optimization algorithm ..."` → null（番号なし）
- `"[close] issue 1966"` → issueNumber: 1966

セッション永続化テスト:
- 新規セッション追加
- 同じ Issue の複数セッション
- Issue CLOSE 時の削除

- [ ] **Step 2: 実装**

`extractIssueNumberFromTitle(title: string): number | null` — 正規表現でタイトルから Issue 番号を抽出。パターン: `(?:Inv|Investigate|close)\s+(?:#?issue\s*)?#?(\d+)` および `#(\d+)` の最初のマッチ。

`ClaudeSessionWatcher` クラス:
- `startWatching()`: `chrome.tabs.onUpdated` / `chrome.tabs.onRemoved` を登録
- `onTabUpdated()`: URL が `claude.ai/code/` なら title から Issue 番号を抽出 → storage に保存
- `onTabRemoved()`: live フラグを false に更新
- `cleanupClosedIssues(openIssueNumbers: Set<number>)`: open でない Issue のセッションを削除
- `getSessions(): Promise<ClaudeSessionStorage>`: storage から全セッション取得

- [ ] **Step 3: テスト実行**

Run: `pnpm test -- src/test/background/claude-session-watcher.test.ts`
Expected: 全 PASS

- [ ] **Step 4: bootstrap.ts に ClaudeSessionWatcher を初期化**

- [ ] **Step 5: コミット**

```bash
git add src/background/claude-session-watcher.ts src/test/background/claude-session-watcher.test.ts src/background/bootstrap.ts
git commit -m "feat: Claude Code Web タブ監視と Issue 番号抽出を追加"
```

---

### Task 16: Svelte — SessionItem + ツリー統合

**Files:**
- Create: `src/sidepanel/components/SessionItem.svelte`
- Modify: `src/sidepanel/components/TreeNode.svelte`

- [ ] **Step 1: SessionItem.svelte を作成**

🤖 アイコンで表示。クリックでセッションタブにフォーカス or 新規タブ。

- [ ] **Step 2: TreeNode.svelte で `session` kind を処理**

`TreeNodeKind.type === "session"` の場合に `SessionItem` をレンダリング。

- [ ] **Step 3: MainScreen で Epic ツリー取得時にセッション情報をマージ**

`FETCH_EPIC_TREE` の結果にセッション情報を overlay する。`ClaudeSessionWatcher.getSessions()` で取得したセッションを、対応する Issue ノードの children に `session` ノードとして追加。

- [ ] **Step 4: Issue CLOSE 検知時のクリーンアップ**

Issue 取得後に `openIssueNumbers` を計算し、`cleanupClosedIssues()` を呼び出す。タイミングは `FETCH_EPIC_TREE` レスポンス受信後。

- [ ] **Step 5: ビルド + テスト**

Run: `pnpm check && pnpm test && GITHUB_CLIENT_ID=Ov23liCgU4UCzg03tnCK pnpm exec vite build`
Expected: 全 PASS

- [ ] **Step 6: コミット**

```bash
git add src/sidepanel/components/SessionItem.svelte src/sidepanel/components/TreeNode.svelte src/sidepanel/components/MainScreen.svelte
git commit -m "feat: Claude Code Web セッション表示をツリーに統合"
```

---

## 最終確認

### Task 17: E2E 動作確認 + クリーンアップ

- [ ] **Step 1: WASM ビルド**

Run: `cd rust-core/crates/adapter-wasm && wasm-pack build --target web`

- [ ] **Step 2: フロントエンドビルド**

Run: `GITHUB_CLIENT_ID=Ov23liCgU4UCzg03tnCK pnpm exec vite build`

- [ ] **Step 3: Chrome に dist/ を読み込んで動作確認**

確認項目:
- [ ] Epic グルーピングが表示される
- [ ] Issue をクリックすると既存タブにフォーカス or 新規タブ
- [ ] Claude Code Web セッションが 🤖 アイコンで表示される
- [ ] タブを閉じてもセッション履歴が残る
- [ ] Review Requests セクションが独立して存在する

- [ ] **Step 4: テスト全実行**

Run: `pnpm test && cd rust-core && cargo test`
Expected: 全 PASS

- [ ] **Step 5: 最終コミット**

```bash
git commit -m "chore: Phase 3 完了、E2E 動作確認済み"
```
