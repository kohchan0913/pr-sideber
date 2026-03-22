use domain::entity::PullRequest;
use serde::Deserialize;

use crate::error::WasmError;

// --- GraphQL レスポンスの serde 構造体 ---
// GitHub GraphQL API の search query レスポンスに対応。
// TS 側の SearchEdge / GraphQLResponse 型と同等の構造。

#[derive(Debug, Deserialize)]
pub struct GraphQLResponse {
    pub data: Option<GraphQLData>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphQLData {
    pub my_prs: Option<SearchResultConnection>,
    pub review_requested: Option<SearchResultConnection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultConnection {
    pub edges: Vec<SearchEdge>,
}

#[derive(Debug, Deserialize)]
pub struct SearchEdge {
    pub node: Option<PrNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrNode {
    pub id: String,
    pub title: String,
    pub url: String,
    pub number: u32,
    pub is_draft: bool,
    pub review_decision: Option<String>,
    pub author: AuthorRef,
    pub commits: CommitConnection,
    pub repository: RepositoryRef,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct AuthorRef {
    pub login: String,
}

#[derive(Debug, Deserialize)]
pub struct CommitConnection {
    pub nodes: Vec<CommitNode>,
}

#[derive(Debug, Deserialize)]
pub struct CommitNode {
    pub commit: CommitInfo,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub status_check_rollup: Option<StatusCheckRollup>,
}

#[derive(Debug, Deserialize)]
pub struct StatusCheckRollup {
    pub state: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryRef {
    pub name_with_owner: String,
}

/// GraphQL レスポンスの JSON 文字列をパースし、PR ノードの Vec に変換する。
/// null ノードはスキップする。
pub fn parse_pull_request_nodes(_json: &str) -> Result<Vec<PullRequest>, WasmError> {
    todo!()
}

/// 単一の PrNode を domain の PullRequest に変換する。
pub fn convert_node_to_pull_request(_node: &PrNode) -> Result<PullRequest, WasmError> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::status::{ApprovalStatus, CiStatus};

    /// 正常な PR ノードを含む最小限の GraphQL レスポンス JSON。
    fn valid_single_pr_json() -> &'static str {
        r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_kwDOTest1",
                                "title": "feat: add new feature",
                                "url": "https://github.com/owner/repo/pull/42",
                                "number": 42,
                                "isDraft": false,
                                "reviewDecision": "APPROVED",
                                "author": { "login": "octocat" },
                                "commits": {
                                    "nodes": [
                                        {
                                            "commit": {
                                                "statusCheckRollup": {
                                                    "state": "SUCCESS"
                                                }
                                            }
                                        }
                                    ]
                                },
                                "repository": {
                                    "nameWithOwner": "owner/repo"
                                },
                                "additions": 100,
                                "deletions": 20,
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": {
                    "edges": []
                }
            }
        }"#
    }

    /// テスト用の最小ノード JSON を生成するヘルパー。
    #[allow(dead_code)]
    fn make_node_json(node_content: &str) -> String {
        format!(
            r#"{{"data": {{"myPrs": {{"edges": [{{"node": {node_content}}}]}}, "reviewRequested": {{"edges": []}}}}}}"#,
        )
    }

    #[test]
    fn parse_valid_pr_node_to_pull_request() {
        let result = parse_pull_request_nodes(valid_single_pr_json());
        assert!(result.is_ok(), "should parse valid JSON: {result:?}");
        let prs = result.unwrap();
        assert_eq!(prs.len(), 1);

        let pr = &prs[0];
        assert_eq!(pr.id(), "PR_kwDOTest1");
        assert_eq!(pr.number(), 42);
        assert_eq!(pr.title(), "feat: add new feature");
        assert_eq!(pr.author(), "octocat");
        assert_eq!(pr.url(), "https://github.com/owner/repo/pull/42");
        assert_eq!(pr.repository(), "owner/repo");
        assert!(!pr.is_draft());
        assert_eq!(pr.approval_status(), ApprovalStatus::Approved);
        assert_eq!(pr.ci_status(), CiStatus::Passed);
        assert_eq!(pr.additions(), 100);
        assert_eq!(pr.deletions(), 20);
        assert_eq!(pr.created_at(), "2026-01-01T00:00:00Z");
        assert_eq!(pr.updated_at(), "2026-01-02T00:00:00Z");
    }

    #[test]
    fn review_decision_null_maps_to_pending() {
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_1",
                                "title": "test pr",
                                "url": "https://github.com/o/r/pull/1",
                                "number": 1,
                                "isDraft": false,
                                "reviewDecision": null,
                                "author": { "login": "alice" },
                                "commits": {
                                    "nodes": [
                                        {
                                            "commit": {
                                                "statusCheckRollup": {
                                                    "state": "SUCCESS"
                                                }
                                            }
                                        }
                                    ]
                                },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": { "edges": [] }
            }
        }"#;

        let prs = parse_pull_request_nodes(json).expect("should parse");
        assert_eq!(prs[0].approval_status(), ApprovalStatus::Pending);
    }

    #[test]
    fn status_check_rollup_null_maps_to_ci_none() {
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_1",
                                "title": "test pr",
                                "url": "https://github.com/o/r/pull/1",
                                "number": 1,
                                "isDraft": false,
                                "reviewDecision": "APPROVED",
                                "author": { "login": "alice" },
                                "commits": {
                                    "nodes": [
                                        {
                                            "commit": {
                                                "statusCheckRollup": null
                                            }
                                        }
                                    ]
                                },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": { "edges": [] }
            }
        }"#;

        let prs = parse_pull_request_nodes(json).expect("should parse");
        assert_eq!(prs[0].ci_status(), CiStatus::None);
    }

    #[test]
    fn empty_commits_nodes_maps_to_ci_none() {
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_1",
                                "title": "test pr",
                                "url": "https://github.com/o/r/pull/1",
                                "number": 1,
                                "isDraft": false,
                                "reviewDecision": "APPROVED",
                                "author": { "login": "alice" },
                                "commits": {
                                    "nodes": []
                                },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": { "edges": [] }
            }
        }"#;

        let prs = parse_pull_request_nodes(json).expect("should parse");
        assert_eq!(prs[0].ci_status(), CiStatus::None);
    }

    #[test]
    fn null_node_is_skipped() {
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        { "node": null },
                        {
                            "node": {
                                "id": "PR_1",
                                "title": "valid pr",
                                "url": "https://github.com/o/r/pull/1",
                                "number": 1,
                                "isDraft": false,
                                "reviewDecision": null,
                                "author": { "login": "alice" },
                                "commits": { "nodes": [] },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": { "edges": [] }
            }
        }"#;

        let prs = parse_pull_request_nodes(json).expect("should parse");
        assert_eq!(prs.len(), 1, "null node should be skipped");
        assert_eq!(prs[0].title(), "valid pr");
    }

    #[test]
    fn invalid_json_returns_error() {
        let result = parse_pull_request_nodes("not valid json at all");
        assert!(result.is_err(), "invalid JSON should return error");
    }

    #[test]
    fn missing_required_field_returns_error() {
        // title フィールドが欠損
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_1",
                                "url": "https://github.com/o/r/pull/1",
                                "number": 1,
                                "isDraft": false,
                                "reviewDecision": null,
                                "author": { "login": "alice" },
                                "commits": { "nodes": [] },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": { "edges": [] }
            }
        }"#;

        let result = parse_pull_request_nodes(json);
        assert!(
            result.is_err(),
            "missing required field should return error"
        );
    }

    #[test]
    fn empty_edges_returns_empty_vec() {
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": []
                },
                "reviewRequested": {
                    "edges": []
                }
            }
        }"#;

        let prs = parse_pull_request_nodes(json).expect("should parse empty edges");
        assert!(prs.is_empty());
    }

    #[test]
    fn additions_deletions_default_to_zero_when_absent() {
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_1",
                                "title": "no additions/deletions",
                                "url": "https://github.com/o/r/pull/1",
                                "number": 1,
                                "isDraft": false,
                                "reviewDecision": null,
                                "author": { "login": "alice" },
                                "commits": { "nodes": [] },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": { "edges": [] }
            }
        }"#;

        let prs = parse_pull_request_nodes(json).expect("should parse");
        assert_eq!(prs[0].additions(), 0);
        assert_eq!(prs[0].deletions(), 0);
    }

    #[test]
    fn both_my_prs_and_review_requested_are_parsed() {
        let json = r#"{
            "data": {
                "myPrs": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_1",
                                "title": "my pr",
                                "url": "https://github.com/o/r/pull/1",
                                "number": 1,
                                "isDraft": false,
                                "reviewDecision": null,
                                "author": { "login": "alice" },
                                "commits": { "nodes": [] },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-02T00:00:00Z"
                            }
                        }
                    ]
                },
                "reviewRequested": {
                    "edges": [
                        {
                            "node": {
                                "id": "PR_2",
                                "title": "review pr",
                                "url": "https://github.com/o/r/pull/2",
                                "number": 2,
                                "isDraft": true,
                                "reviewDecision": "CHANGES_REQUESTED",
                                "author": { "login": "bob" },
                                "commits": { "nodes": [] },
                                "repository": { "nameWithOwner": "o/r" },
                                "createdAt": "2026-01-01T00:00:00Z",
                                "updatedAt": "2026-01-03T00:00:00Z"
                            }
                        }
                    ]
                }
            }
        }"#;

        let prs = parse_pull_request_nodes(json).expect("should parse");
        assert_eq!(prs.len(), 2);
    }
}
