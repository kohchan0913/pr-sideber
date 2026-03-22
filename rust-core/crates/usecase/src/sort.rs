use domain::entity::PullRequest;

pub fn sort_by_updated_at_desc(pull_requests: &mut [PullRequest]) {
    pull_requests.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::status::{ApprovalStatus, CiStatus};

    fn make_pr(number: u32, updated_at: &str) -> PullRequest {
        PullRequest {
            id: format!("PR_{number}"),
            number,
            title: format!("PR #{number}"),
            author: "octocat".to_string(),
            url: format!("https://github.com/owner/repo/pull/{number}"),
            repository: "owner/repo".to_string(),
            is_draft: false,
            approval_status: ApprovalStatus::Approved,
            ci_status: CiStatus::Passed,
            additions: 10,
            deletions: 5,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: updated_at.to_string(),
        }
    }

    #[test]
    fn sorts_by_updated_at_descending() {
        let mut prs = vec![
            make_pr(1, "2026-01-01T00:00:00Z"),
            make_pr(2, "2026-01-03T00:00:00Z"),
            make_pr(3, "2026-01-02T00:00:00Z"),
        ];
        sort_by_updated_at_desc(&mut prs);
        assert_eq!(prs[0].number, 2);
        assert_eq!(prs[1].number, 3);
        assert_eq!(prs[2].number, 1);
    }

    #[test]
    fn already_sorted_stays_same() {
        let mut prs = vec![
            make_pr(1, "2026-01-03T00:00:00Z"),
            make_pr(2, "2026-01-02T00:00:00Z"),
            make_pr(3, "2026-01-01T00:00:00Z"),
        ];
        sort_by_updated_at_desc(&mut prs);
        assert_eq!(prs[0].number, 1);
        assert_eq!(prs[1].number, 2);
        assert_eq!(prs[2].number, 3);
    }

    #[test]
    fn empty_list_does_not_panic() {
        let mut prs: Vec<PullRequest> = vec![];
        sort_by_updated_at_desc(&mut prs);
        assert!(prs.is_empty());
    }

    #[test]
    fn single_element_stays_same() {
        let mut prs = vec![make_pr(1, "2026-01-01T00:00:00Z")];
        sort_by_updated_at_desc(&mut prs);
        assert_eq!(prs[0].number, 1);
    }

    /// Stable sort が必要: 同一 updated_at の PR は元の順序を維持する。
    /// sort_unstable_by ではなく sort_by を使うこと。
    #[test]
    fn same_updated_at_preserves_original_order() {
        let mut prs = vec![
            make_pr(1, "2026-01-01T00:00:00Z"),
            make_pr(2, "2026-01-01T00:00:00Z"),
            make_pr(3, "2026-01-01T00:00:00Z"),
        ];
        sort_by_updated_at_desc(&mut prs);
        assert_eq!(prs[0].number, 1);
        assert_eq!(prs[1].number, 2);
        assert_eq!(prs[2].number, 3);
    }
}
