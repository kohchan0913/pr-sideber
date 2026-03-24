/// PR URL からベース URL (PR トップページ) を抽出する。
/// PR URL でない場合は None を返す。
pub fn extract_pr_base_url(_url: &str) -> Option<String> {
    todo!()
}

/// URL が PR のサブページ (/files, /commits, /checks など) かどうかを判定する。
pub fn is_pr_sub_page(_url: &str) -> bool {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    mod extract_pr_base_url_tests {
        use super::*;

        #[test]
        fn pr_top_url_returns_itself() {
            assert_eq!(
                extract_pr_base_url("https://github.com/owner/repo/pull/123"),
                Some("https://github.com/owner/repo/pull/123".to_string())
            );
        }

        #[test]
        fn files_sub_page_returns_pr_top() {
            assert_eq!(
                extract_pr_base_url("https://github.com/owner/repo/pull/123/files"),
                Some("https://github.com/owner/repo/pull/123".to_string())
            );
        }

        #[test]
        fn commits_sub_page_returns_pr_top() {
            assert_eq!(
                extract_pr_base_url("https://github.com/owner/repo/pull/123/commits"),
                Some("https://github.com/owner/repo/pull/123".to_string())
            );
        }

        #[test]
        fn checks_sub_page_returns_pr_top() {
            assert_eq!(
                extract_pr_base_url("https://github.com/owner/repo/pull/123/checks"),
                Some("https://github.com/owner/repo/pull/123".to_string())
            );
        }

        #[test]
        fn trailing_slash_returns_pr_top() {
            assert_eq!(
                extract_pr_base_url("https://github.com/owner/repo/pull/123/"),
                Some("https://github.com/owner/repo/pull/123".to_string())
            );
        }

        #[test]
        fn non_pr_url_returns_none() {
            assert_eq!(extract_pr_base_url("https://github.com/owner/repo"), None);
        }

        #[test]
        fn invalid_url_returns_none() {
            assert_eq!(extract_pr_base_url("not-a-url"), None);
        }

        #[test]
        fn empty_string_returns_none() {
            assert_eq!(extract_pr_base_url(""), None);
        }

        #[test]
        fn issues_url_returns_none() {
            assert_eq!(
                extract_pr_base_url("https://github.com/owner/repo/issues/42"),
                None
            );
        }
    }

    mod is_pr_sub_page_tests {
        use super::*;

        #[test]
        fn files_page_is_sub_page() {
            assert!(is_pr_sub_page(
                "https://github.com/owner/repo/pull/123/files"
            ));
        }

        #[test]
        fn commits_page_is_sub_page() {
            assert!(is_pr_sub_page(
                "https://github.com/owner/repo/pull/123/commits"
            ));
        }

        #[test]
        fn checks_page_is_sub_page() {
            assert!(is_pr_sub_page(
                "https://github.com/owner/repo/pull/123/checks"
            ));
        }

        #[test]
        fn pr_top_page_is_not_sub_page() {
            assert!(!is_pr_sub_page("https://github.com/owner/repo/pull/123"));
        }

        #[test]
        fn non_pr_url_is_not_sub_page() {
            assert!(!is_pr_sub_page("https://github.com/owner/repo"));
        }

        #[test]
        fn empty_string_is_not_sub_page() {
            assert!(!is_pr_sub_page(""));
        }

        #[test]
        fn invalid_url_is_not_sub_page() {
            assert!(!is_pr_sub_page("not-a-url"));
        }
    }
}
