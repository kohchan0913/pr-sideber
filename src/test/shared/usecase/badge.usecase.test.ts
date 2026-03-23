import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BadgePort } from "../../../domain/ports/badge.port";
import { createBadgeUseCase } from "../../../shared/usecase/badge.usecase";

describe("badge usecase", () => {
	let mockBadge: {
		[K in keyof BadgePort]: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockBadge = {
			setBadgeText: vi.fn().mockResolvedValue(undefined),
			setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("updateBadge", () => {
		it("should set badge text to empty string when reviewRequestCount is 0", async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(0);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("");
		});

		it("should not set badge background color when reviewRequestCount is 0", async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(0);

			expect(mockBadge.setBadgeBackgroundColor).not.toHaveBeenCalled();
		});

		it('should set badge text to "1" when reviewRequestCount is 1', async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(1);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("1");
		});

		it('should set badge text to "99" when reviewRequestCount is 99', async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(99);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("99");
		});

		it('should set badge text to "99+" when reviewRequestCount is 100 or more', async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(100);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("99+");
		});

		it('should set badge text to "99+" when reviewRequestCount is 999', async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(999);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("99+");
		});

		it("should set badge background color when reviewRequestCount is greater than 0", async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(5);

			expect(mockBadge.setBadgeBackgroundColor).toHaveBeenCalledWith(
				expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
			);
		});

		it("should treat negative count as 0 (clear badge)", async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(-1);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("");
			expect(mockBadge.setBadgeBackgroundColor).not.toHaveBeenCalled();
		});

		it("should clear badge when reviewRequestCount is NaN", async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(Number.NaN);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("");
			expect(mockBadge.setBadgeBackgroundColor).not.toHaveBeenCalled();
		});

		it("should clear badge when reviewRequestCount is Infinity", async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(Number.POSITIVE_INFINITY);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("");
			expect(mockBadge.setBadgeBackgroundColor).not.toHaveBeenCalled();
		});

		it("should floor non-integer counts", async () => {
			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(3.7);

			expect(mockBadge.setBadgeText).toHaveBeenCalledWith("3");
		});

		it("should set background color before badge text when count > 0", async () => {
			const callOrder: string[] = [];
			mockBadge.setBadgeBackgroundColor.mockImplementation(() => {
				callOrder.push("setBadgeBackgroundColor");
				return Promise.resolve();
			});
			mockBadge.setBadgeText.mockImplementation(() => {
				callOrder.push("setBadgeText");
				return Promise.resolve();
			});

			const useCase = createBadgeUseCase(mockBadge);
			await useCase.updateBadge(5);

			expect(callOrder).toEqual(["setBadgeBackgroundColor", "setBadgeText"]);
		});
	});
});
