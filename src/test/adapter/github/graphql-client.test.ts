import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubGraphQLClient } from "../../../adapter/github/graphql-client";
import type { GitHubApiPort } from "../../../domain/ports/github-api.port";
import { GitHubApiError } from "../../../shared/types/errors";
import type { GraphQLResponse } from "../../../shared/types/github";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const TEST_TOKEN = "gho_test_access_token_12345";

function createSuccessResponse(
	myPrsNodes: GraphQLResponse["data"] extends infer D
		? D extends { myPrs: { edges: readonly (infer E)[] } }
			? E[]
			: never
		: never = [],
	reviewRequestedNodes: GraphQLResponse["data"] extends infer D
		? D extends { reviewRequested: { edges: readonly (infer E)[] } }
			? E[]
			: never
		: never = [],
): GraphQLResponse {
	return {
		data: {
			myPrs: { edges: myPrsNodes },
			reviewRequested: { edges: reviewRequestedNodes },
		},
	};
}

function createPrEdge(overrides: {
	title?: string;
	url?: string;
	number?: number;
	isDraft?: boolean;
	reviewDecision?: string | null;
	statusState?: string | null;
	nameWithOwner?: string;
	createdAt?: string;
	updatedAt?: string;
} = {}) {
	return {
		node: {
			title: overrides.title ?? "Test PR",
			url: overrides.url ?? "https://github.com/owner/repo/pull/1",
			number: overrides.number ?? 1,
			isDraft: overrides.isDraft ?? false,
			reviewDecision: overrides.reviewDecision ?? null,
			commits: {
				nodes:
					overrides.statusState === undefined
						? []
						: [
								{
									commit: {
										statusCheckRollup:
											overrides.statusState === null
												? null
												: { state: overrides.statusState },
									},
								},
							],
			},
			repository: {
				nameWithOwner: overrides.nameWithOwner ?? "owner/repo",
			},
			createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
			updatedAt: overrides.updatedAt ?? "2026-01-02T00:00:00Z",
		},
	};
}

describe("GitHubGraphQLClient", () => {
	let client: GitHubApiPort;
	let mockGetAccessToken: ReturnType<typeof vi.fn>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		mockGetAccessToken = vi.fn().mockResolvedValue(TEST_TOKEN);
		client = new GitHubGraphQLClient(mockGetAccessToken);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe("fetchPullRequests - 正常系", () => {
		it("should include Authorization header with Bearer token", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse(),
			});

			await client.fetchPullRequests();

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(options.headers).toEqual(
				expect.objectContaining({
					Authorization: `Bearer ${TEST_TOKEN}`,
				}),
			);
		});

		it("should POST to GitHub GraphQL endpoint", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse(),
			});

			await client.fetchPullRequests();

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(GRAPHQL_ENDPOINT);
			expect(options.method).toBe("POST");
		});

		it("should parse myPrs and reviewRequested from response", async () => {
			const myPrEdge = createPrEdge({
				title: "My PR",
				number: 10,
				nameWithOwner: "me/my-repo",
			});
			const reviewEdge = createPrEdge({
				title: "Review PR",
				number: 20,
				nameWithOwner: "other/other-repo",
			});

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse([myPrEdge], [reviewEdge]),
			});

			const result = await client.fetchPullRequests();

			expect(result.myPrs).toHaveLength(1);
			expect(result.myPrs[0].title).toBe("My PR");
			expect(result.myPrs[0].number).toBe(10);
			expect(result.myPrs[0].repository.nameWithOwner).toBe("me/my-repo");

			expect(result.reviewRequested).toHaveLength(1);
			expect(result.reviewRequested[0].title).toBe("Review PR");
			expect(result.reviewRequested[0].number).toBe(20);
		});

		it("should correctly map reviewDecision, isDraft, and commit status", async () => {
			const edge = createPrEdge({
				isDraft: true,
				reviewDecision: "APPROVED",
				statusState: "SUCCESS",
			});

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse([edge]),
			});

			const result = await client.fetchPullRequests();

			expect(result.myPrs[0].isDraft).toBe(true);
			expect(result.myPrs[0].reviewDecision).toBe("APPROVED");
			expect(result.myPrs[0].commitStatusState).toBe("SUCCESS");
		});

		it("should return empty arrays when no results", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse(),
			});

			const result = await client.fetchPullRequests();

			expect(result.myPrs).toEqual([]);
			expect(result.reviewRequested).toEqual([]);
		});

		it("should handle PR with no CI status (statusCheckRollup is null)", async () => {
			const edge = createPrEdge({ statusState: null });

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse([edge]),
			});

			const result = await client.fetchPullRequests();

			expect(result.myPrs[0].commitStatusState).toBeNull();
		});

		it("should handle PR with no commits nodes (empty array)", async () => {
			// statusState undefined means no commits nodes
			const edge = createPrEdge();

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse([edge]),
			});

			const result = await client.fetchPullRequests();

			expect(result.myPrs[0].commitStatusState).toBeNull();
		});
	});

	describe("fetchPullRequests - エラー系", () => {
		it("should throw GitHubApiError with 'unauthorized' on HTTP 401", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
			});

			const error = await client.fetchPullRequests().catch((e: unknown) => e);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect((error as GitHubApiError).code).toBe("unauthorized");
			expect((error as GitHubApiError).statusCode).toBe(401);
		});

		it("should throw GitHubApiError with 'forbidden' on HTTP 403", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				statusText: "Forbidden",
			});

			const error = await client.fetchPullRequests().catch((e: unknown) => e);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect((error as GitHubApiError).code).toBe("forbidden");
			expect((error as GitHubApiError).statusCode).toBe(403);
		});

		it("should throw GitHubApiError with 'server_error' on HTTP 500", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});

			const error = await client.fetchPullRequests().catch((e: unknown) => e);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect((error as GitHubApiError).code).toBe("server_error");
			expect((error as GitHubApiError).statusCode).toBe(500);
		});

		it("should throw GitHubApiError with 'network_error' on fetch rejection", async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

			const error = await client.fetchPullRequests().catch((e: unknown) => e);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect((error as GitHubApiError).code).toBe("network_error");
			expect((error as GitHubApiError).message).toContain("Failed to fetch");
		});

		it("should throw GitHubApiError with 'graphql_error' when response has errors field", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					errors: [{ message: "Field 'foo' doesn't exist" }],
				}),
			});

			const error = await client.fetchPullRequests().catch((e: unknown) => e);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect((error as GitHubApiError).code).toBe("graphql_error");
			expect((error as GitHubApiError).message).toContain("Field 'foo' doesn't exist");
		});

		it("should throw GitHubApiError with 'unknown' on invalid JSON response", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => {
					throw new SyntaxError("Unexpected token < in JSON");
				},
			});

			const error = await client.fetchPullRequests().catch((e: unknown) => e);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect((error as GitHubApiError).code).toBe("unknown");
		});
	});

	describe("fetchPullRequests - 設計確認", () => {
		it("should not include token in URL parameters", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse(),
			});

			await client.fetchPullRequests();

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [url] = fetchMock.mock.calls[0] as [string];
			expect(url).not.toContain(TEST_TOKEN);
			expect(url).not.toContain("access_token");
		});

		it("should set Content-Type to application/json", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => createSuccessResponse(),
			});

			await client.fetchPullRequests();

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(options.headers).toEqual(
				expect.objectContaining({
					"Content-Type": "application/json",
				}),
			);
		});
	});
});
