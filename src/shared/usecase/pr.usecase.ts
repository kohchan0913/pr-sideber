import type { FetchRawPullRequestsResult } from "../../domain/types/github";
import type { PrProcessorPort, ProcessedPrsResult } from "../../domain/ports/pr-processor.port";
import type { SendMessage } from "../../shared/ports/message.port";

export function createPrUseCase(sendMessage: SendMessage, prProcessor: PrProcessorPort) {
	async function fetchPrs(login: string): Promise<ProcessedPrsResult & { hasMore: boolean }> {
		const response = await sendMessage("FETCH_PRS");
		if (!response.ok) {
			throw new Error(response.error.message);
		}
		const raw: FetchRawPullRequestsResult = response.data;
		const processed = prProcessor.processPullRequests(raw.rawJson, login);
		return { ...processed, hasMore: raw.hasMore };
	}

	return { fetchPrs };
}
