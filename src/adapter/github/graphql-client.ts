import type { GitHubApiPort } from "../../domain/ports/github-api.port";
import { GitHubApiError } from "../../shared/types/errors";
import type {
	FetchPullRequestsResult,
	GraphQLResponse,
	PullRequest,
	SearchEdge,
} from "../../shared/types/github";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

const PULL_REQUESTS_QUERY = `
query {
  myPrs: search(query: "author:@me is:open is:pr", type: ISSUE, first: 50) {
    edges {
      node {
        ... on PullRequest {
          title
          url
          number
          isDraft
          reviewDecision
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
        }
      }
    }
  }
  reviewRequested: search(query: "review-requested:@me is:open is:pr", type: ISSUE, first: 50) {
    edges {
      node {
        ... on PullRequest {
          title
          url
          number
          isDraft
          reviewDecision
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
        }
      }
    }
  }
}
`;

export class GitHubGraphQLClient implements GitHubApiPort {
	constructor(private readonly getAccessToken: () => Promise<string>) {}

	async fetchPullRequests(): Promise<FetchPullRequestsResult> {
		const token = await this.getAccessToken();
		const response = await this.executeQuery(token);
		const body = await this.parseResponseBody(response);

		this.checkGraphQLErrors(body);

		if (!body.data) {
			throw new GitHubApiError("unknown", "GraphQL response missing data field");
		}

		return {
			myPrs: body.data.myPrs.edges.map(mapEdgeToPullRequest),
			reviewRequested: body.data.reviewRequested.edges.map(mapEdgeToPullRequest),
		};
	}

	private async executeQuery(token: string): Promise<Response> {
		let response: Response;
		try {
			response = await fetch(GRAPHQL_ENDPOINT, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ query: PULL_REQUESTS_QUERY }),
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown network error";
			throw new GitHubApiError("network_error", message);
		}

		if (!response.ok) {
			throw new GitHubApiError(
				mapHttpStatusToErrorCode(response.status),
				`GitHub API error: ${response.status} ${response.statusText}`,
				response.status,
			);
		}

		return response;
	}

	private async parseResponseBody(response: Response): Promise<GraphQLResponse> {
		try {
			return (await response.json()) as GraphQLResponse;
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown parse error";
			throw new GitHubApiError("unknown", `Failed to parse response: ${message}`);
		}
	}

	private checkGraphQLErrors(body: GraphQLResponse): void {
		if (body.errors && body.errors.length > 0) {
			const messages = body.errors.map((e) => e.message).join("; ");
			throw new GitHubApiError("graphql_error", `GraphQL errors: ${messages}`);
		}
	}
}

function mapHttpStatusToErrorCode(status: number): GitHubApiError["code"] {
	if (status === 401) return "unauthorized";
	if (status === 403) return "forbidden";
	if (status >= 500) return "server_error";
	return "unknown";
}

function mapEdgeToPullRequest(edge: SearchEdge): PullRequest {
	const node = edge.node;
	const lastCommit = node.commits.nodes.length > 0 ? node.commits.nodes[0] : null;
	const statusState = lastCommit?.commit.statusCheckRollup?.state ?? null;

	return {
		title: node.title,
		url: node.url,
		number: node.number,
		isDraft: node.isDraft,
		reviewDecision: node.reviewDecision,
		commitStatusState: statusState,
		repository: {
			nameWithOwner: node.repository.nameWithOwner,
		},
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
	};
}
