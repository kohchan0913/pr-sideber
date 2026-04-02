import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type WorkspaceTabOps,
	createWorkspaceLayoutUseCase,
} from "../../background/workspace-layout.usecase";
import { resetChromeMock, setupChromeMock } from "../mocks/chrome.mock";

function createMockTabOps(): {
	[K in keyof WorkspaceTabOps]: ReturnType<typeof vi.fn>;
} {
	return {
		findTabByUrl: vi.fn(),
		activateTab: vi.fn(),
		openTabInWindow: vi.fn(),
		findWindowByTabPattern: vi.fn(),
		getCurrentWindowId: vi.fn(),
	};
}

describe("createWorkspaceLayoutUseCase", () => {
	let tabs: ReturnType<typeof createMockTabOps>;

	beforeEach(() => {
		setupChromeMock();
		tabs = createMockTabOps();
		tabs.activateTab.mockResolvedValue(undefined);
		tabs.openTabInWindow.mockResolvedValue(undefined);
		tabs.findWindowByTabPattern.mockResolvedValue(null);
		tabs.getCurrentWindowId.mockResolvedValue(1);
	});

	afterEach(() => {
		resetChromeMock();
	});

	it("should open 3 tabs in appropriate windows when no existing tabs found", async () => {
		tabs.findTabByUrl.mockResolvedValue(null);
		tabs.findWindowByTabPattern
			.mockResolvedValueOnce(10) // claude.ai window
			.mockResolvedValueOnce(20) // github.com window
			.mockResolvedValueOnce(20); // github.com window
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: "https://github.com/owner/repo/pull/123",
			sessionUrl: "https://claude.ai/code/session-1",
		});
		expect(tabs.openTabInWindow).toHaveBeenCalledTimes(3);
		expect(tabs.openTabInWindow).toHaveBeenCalledWith("https://claude.ai/code/session-1", 10);
		expect(tabs.openTabInWindow).toHaveBeenCalledWith(
			"https://github.com/owner/repo/issues/42",
			20,
		);
		expect(tabs.openTabInWindow).toHaveBeenCalledWith("https://github.com/owner/repo/pull/123", 20);
	});

	it("should activate existing tab instead of opening new one", async () => {
		tabs.findTabByUrl
			.mockResolvedValueOnce(10) // session found
			.mockResolvedValueOnce(null) // issue not found
			.mockResolvedValueOnce(null); // pr not found
		tabs.findWindowByTabPattern.mockResolvedValue(1);
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: "https://github.com/owner/repo/pull/123",
			sessionUrl: "https://claude.ai/code/session-1",
		});
		expect(tabs.activateTab).toHaveBeenCalledWith(10);
		expect(tabs.openTabInWindow).toHaveBeenCalledTimes(2);
	});

	it("should skip null resources without opening tabs", async () => {
		tabs.findTabByUrl.mockResolvedValue(null);
		tabs.findWindowByTabPattern.mockResolvedValue(1);
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: null,
			sessionUrl: null,
		});
		// Issue のみ開かれる。PR と Session はスキップ
		expect(tabs.openTabInWindow).toHaveBeenCalledTimes(1);
		expect(tabs.openTabInWindow).toHaveBeenCalledWith("https://github.com/owner/repo/issues/42", 1);
	});

	it("should fall back to current window when no matching window found", async () => {
		tabs.findTabByUrl.mockResolvedValue(null);
		tabs.findWindowByTabPattern.mockResolvedValue(null);
		tabs.getCurrentWindowId.mockResolvedValue(99);
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: null,
			sessionUrl: "https://claude.ai/code/session-1",
		});
		expect(tabs.openTabInWindow).toHaveBeenCalledWith("https://claude.ai/code/session-1", 99);
		expect(tabs.openTabInWindow).toHaveBeenCalledWith(
			"https://github.com/owner/repo/issues/42",
			99,
		);
	});

	it("should activate all 3 existing tabs without opening new ones", async () => {
		tabs.findTabByUrl.mockResolvedValueOnce(10).mockResolvedValueOnce(20).mockResolvedValueOnce(30);
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: "https://github.com/owner/repo/pull/123",
			sessionUrl: "https://claude.ai/code/session-1",
		});
		expect(tabs.activateTab).toHaveBeenCalledTimes(3);
		expect(tabs.openTabInWindow).not.toHaveBeenCalled();
	});
});
