export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;

export type StatusState = "EXPECTED" | "ERROR" | "FAILURE" | "PENDING" | "SUCCESS";

export type PullRequest = {
	readonly title: string;
	readonly url: string;
	readonly number: number;
	readonly isDraft: boolean;
	readonly reviewDecision: ReviewDecision;
	readonly commitStatusState: StatusState | null;
	readonly repository: {
		readonly nameWithOwner: string;
	};
	readonly createdAt: string;
	readonly updatedAt: string;
};

export type SearchEdge = {
	readonly node: {
		readonly title: string;
		readonly url: string;
		readonly number: number;
		readonly isDraft: boolean;
		readonly reviewDecision: ReviewDecision;
		readonly commits: {
			readonly nodes: ReadonlyArray<{
				readonly commit: {
					readonly statusCheckRollup: {
						readonly state: StatusState;
					} | null;
				};
			}>;
		};
		readonly repository: {
			readonly nameWithOwner: string;
		};
		readonly createdAt: string;
		readonly updatedAt: string;
	};
};

export type SearchResultConnection = {
	readonly edges: readonly SearchEdge[];
};

export type GraphQLResponse = {
	readonly data?: {
		readonly myPrs: SearchResultConnection;
		readonly reviewRequested: SearchResultConnection;
	};
	readonly errors?: ReadonlyArray<{
		readonly message: string;
	}>;
};

export type FetchPullRequestsResult = {
	readonly myPrs: readonly PullRequest[];
	readonly reviewRequested: readonly PullRequest[];
};
