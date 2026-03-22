import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrProcessorPort, ProcessedPrsResult } from "../../../domain/ports/pr-processor.port";
import type { SendMessage } from "../../../shared/ports/message.port";
import { createPrUseCase } from "../../../shared/usecase/pr.usecase";

describe("pr usecase", () => {
	let mockSendMessage: ReturnType<typeof vi.fn>;
	let mockPrProcessor: PrProcessorPort;
	const mockProcessedResult: ProcessedPrsResult = {
		myPrs: {
			items: [
				{
					id: "PR_1",
					number: 1,
					title: "feat: add PR list",
					author: "testuser",
					url: "https://github.com/owner/repo/pull/1",
					repository: "owner/repo",
					isDraft: false,
					approvalStatus: "Approved",
					ciStatus: "Passed",
					additions: 10,
					deletions: 5,
					createdAt: "2026-03-20T00:00:00Z",
					updatedAt: "2026-03-21T00:00:00Z",
				},
			],
			totalCount: 1,
		},
		reviewRequests: {
			items: [],
			totalCount: 0,
		},
	};

	beforeEach(() => {
		mockSendMessage = vi.fn();
		mockPrProcessor = {
			processPullRequests: vi.fn().mockReturnValue(mockProcessedResult),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("fetchPrs", () => {
		it("should send FETCH_PRS message, process via WASM, and return ProcessedPrsResult", async () => {
			const rawResult = { rawJson: '{"data":{}}', hasMore: false };
			const response = { ok: true as const, data: rawResult };
			mockSendMessage.mockResolvedValue(response);

			const useCase = createPrUseCase(mockSendMessage as SendMessage, mockPrProcessor);
			const result = await useCase.fetchPrs("testuser");

			expect(mockSendMessage).toHaveBeenCalledWith("FETCH_PRS");
			expect(mockPrProcessor.processPullRequests).toHaveBeenCalledWith('{"data":{}}', "testuser");
			expect(result.myPrs).toEqual(mockProcessedResult.myPrs);
			expect(result.reviewRequests).toEqual(mockProcessedResult.reviewRequests);
			expect(result.hasMore).toBe(false);
		});

		it("should throw when sendMessage returns error response", async () => {
			const response = {
				ok: false as const,
				error: { code: "FETCH_PRS_ERROR", message: "Failed to fetch pull requests" },
			};
			mockSendMessage.mockResolvedValue(response);

			const useCase = createPrUseCase(mockSendMessage as SendMessage, mockPrProcessor);

			await expect(useCase.fetchPrs("testuser")).rejects.toThrow("Failed to fetch pull requests");
		});

		it("should propagate error when sendMessage rejects", async () => {
			mockSendMessage.mockRejectedValue(new Error("Network error"));

			const useCase = createPrUseCase(mockSendMessage as SendMessage, mockPrProcessor);

			await expect(useCase.fetchPrs("testuser")).rejects.toThrow("Network error");
		});

		it("should return hasMore: true when API indicates more results", async () => {
			const rawResult = { rawJson: '{"data":{}}', hasMore: true };
			const response = { ok: true as const, data: rawResult };
			mockSendMessage.mockResolvedValue(response);

			const useCase = createPrUseCase(mockSendMessage as SendMessage, mockPrProcessor);
			const result = await useCase.fetchPrs("testuser");

			expect(result.hasMore).toBe(true);
		});
	});
});
