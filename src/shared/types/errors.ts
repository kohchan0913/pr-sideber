export type GitHubApiErrorCode =
	| "unauthorized"
	| "forbidden"
	| "server_error"
	| "network_error"
	| "graphql_error"
	| "unknown";

export class GitHubApiError extends Error {
	readonly code: GitHubApiErrorCode;
	readonly statusCode?: number;

	constructor(code: GitHubApiErrorCode, message: string, statusCode?: number) {
		super(message);
		this.name = "GitHubApiError";
		this.code = code;
		this.statusCode = statusCode;
	}
}
