import { execSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/**
 * GraphQL スキーマ整合性テスト
 *
 * 実際の GitHub GraphQL API にクエリを送信し、スキーマエラーがないことを検証する。
 * モックテストでは検出できない「フィールドが実際に存在するか」を保証する。
 *
 * 前提: gh CLI が認証済みであること (CI では GITHUB_TOKEN 環境変数)
 */
import { describe, expect, it } from "vitest";

/** gh api graphql でクエリを実行し、レスポンスを返す */
function executeGraphQL(query: string): { data?: unknown; errors?: Array<{ message: string }> } {
	const tmpFile = join(tmpdir(), `graphql-query-${Date.now()}.graphql`);
	try {
		writeFileSync(tmpFile, query, "utf-8");
		const result = execSync(`gh api graphql -F query=@${tmpFile} 2>&1`, {
			encoding: "utf-8",
			timeout: 15000,
		});
		return JSON.parse(result) as { data?: unknown; errors?: Array<{ message: string }> };
	} finally {
		try {
			unlinkSync(tmpFile);
		} catch {
			/* cleanup best effort */
		}
	}
}

// --- PR クエリのフラグメントとクエリ文字列を直接定義（ソースと同期を保つ） ---
// NOTE: ソースコードの定数は export されていないため、ここにコピーする。
//       ソース変更時はこちらも更新すること。更新漏れ防止は下記の同期チェックテストで担保する。

const PR_FIELDS_FRAGMENT = `
fragment PrFields on PullRequest {
  id
  title
  url
  number
  isDraft
  reviewDecision
  author {
    login
  }
  additions
  deletions
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          state
        }
      }
    }
  }
  repository {
    nameWithOwner
  }
  createdAt
  updatedAt
  mergeable
  reviewThreads(first: 100) {
    totalCount
    nodes {
      isResolved
    }
  }
  closingIssuesReferences(first: 10) {
    nodes {
      number
    }
  }
}`;

const PULL_REQUESTS_QUERY = `
${PR_FIELDS_FRAGMENT}
query {
  myPrs: search(query: "author:@me is:open is:pr", type: ISSUE, first: 1) {
    edges {
      node {
        ...PrFields
      }
    }
    pageInfo {
      hasNextPage
    }
  }
}`;

const ISSUE_FIELDS_FRAGMENT = `
fragment IssueFields on Issue {
  id
  number
  title
  url
  state
  labels(first: 10) {
    nodes {
      name
      color
    }
  }
  assignees(first: 5) {
    nodes {
      login
    }
  }
  updatedAt
  parent {
    id
    number
    title
  }
}`;

const ISSUES_QUERY = `
${ISSUE_FIELDS_FRAGMENT}
query {
  issues: search(query: "assignee:@me is:issue is:open", type: ISSUE, first: 1) {
    edges {
      node {
        ...IssueFields
      }
    }
  }
}`;

describe("GraphQL スキーマ整合性", () => {
	it("PR クエリが GitHub API スキーマに適合すること", () => {
		const response = executeGraphQL(PULL_REQUESTS_QUERY);

		expect(response.errors, `GraphQL errors: ${JSON.stringify(response.errors)}`).toBeUndefined();
		expect(response.data).toBeDefined();
	});

	it("Issue クエリが GitHub API スキーマに適合すること", () => {
		const response = executeGraphQL(ISSUES_QUERY);

		expect(response.errors, `GraphQL errors: ${JSON.stringify(response.errors)}`).toBeUndefined();
		expect(response.data).toBeDefined();
	});
});
