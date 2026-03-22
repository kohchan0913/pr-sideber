use serde::{Deserialize, Serialize};

use crate::status::{ApprovalStatus, CiStatus};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequest {
    pub id: String,
    pub number: u32,
    pub title: String,
    pub author: String,
    pub url: String,
    pub repository: String,
    pub is_draft: bool,
    pub approval_status: ApprovalStatus,
    pub ci_status: CiStatus,
    pub additions: u32,
    pub deletions: u32,
    /// ISO 8601 形式の文字列 (例: "2026-01-01T00:00:00Z")。
    /// chrono を使わず String にしているのは WASM バイナリサイズ削減のため。
    /// ISO 8601 は辞書順ソートで時系列順が保証される。
    pub created_at: String,
    /// ISO 8601 形式の文字列 (例: "2026-01-02T00:00:00Z")。
    /// `created_at` と同じ理由で String を採用。
    pub updated_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::status::{ApprovalStatus, CiStatus};

    fn make_pr() -> PullRequest {
        PullRequest {
            id: "PR_123".to_string(),
            number: 42,
            title: "Add feature X".to_string(),
            author: "octocat".to_string(),
            url: "https://github.com/owner/repo/pull/42".to_string(),
            repository: "owner/repo".to_string(),
            is_draft: false,
            approval_status: ApprovalStatus::Approved,
            ci_status: CiStatus::Passed,
            additions: 100,
            deletions: 20,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-02T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn pull_request_construction() {
        let pr = make_pr();
        assert_eq!(pr.number, 42);
        assert_eq!(pr.title, "Add feature X");
        assert_eq!(pr.author, "octocat");
        assert!(!pr.is_draft);
        assert_eq!(pr.approval_status, ApprovalStatus::Approved);
        assert_eq!(pr.ci_status, CiStatus::Passed);
    }

    #[test]
    fn pull_request_serde_roundtrip() {
        let original = make_pr();
        let json = serde_json::to_string(&original).expect("serialize should succeed");
        let restored: PullRequest =
            serde_json::from_str(&json).expect("deserialize should succeed");
        assert_eq!(original, restored);
    }

    #[test]
    fn pull_request_serde_camel_case_fields() {
        let pr = make_pr();
        let json = serde_json::to_string(&pr).expect("serialize should succeed");
        // camelCase field names
        assert!(json.contains("\"isDraft\""));
        assert!(json.contains("\"approvalStatus\""));
        assert!(json.contains("\"ciStatus\""));
        assert!(json.contains("\"createdAt\""));
        assert!(json.contains("\"updatedAt\""));
    }

    #[test]
    fn pull_request_clone() {
        let original = make_pr();
        let cloned = original.clone();
        assert_eq!(original, cloned);
    }
}
