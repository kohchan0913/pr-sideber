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
		openNewTab: vi.fn(),
	};
}

describe("createWorkspaceLayoutUseCase", () => {
	let tabs: ReturnType<typeof createMockTabOps>;

	beforeEach(() => {
		setupChromeMock();
		tabs = createMockTabOps();
		tabs.activateTab.mockResolvedValue(undefined);
		tabs.openNewTab.mockResolvedValue(undefined);
	});

	afterEach(() => {
		resetChromeMock();
	});

	it("should open 3 new tabs when no existing tabs found", async () => {
		tabs.findTabByUrl.mockResolvedValue(null);
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: "https://github.com/owner/repo/pull/123",
			sessionUrl: "https://claude.ai/code/session-1",
		});
		expect(tabs.openNewTab).toHaveBeenCalledTimes(3);
		expect(tabs.openNewTab).toHaveBeenCalledWith("https://claude.ai/code/session-1");
		expect(tabs.openNewTab).toHaveBeenCalledWith("https://github.com/owner/repo/issues/42");
		expect(tabs.openNewTab).toHaveBeenCalledWith("https://github.com/owner/repo/pull/123");
	});

	it("should activate existing tab instead of opening new one", async () => {
		tabs.findTabByUrl
			.mockResolvedValueOnce(10) // session found
			.mockResolvedValueOnce(null) // issue not found
			.mockResolvedValueOnce(null); // pr not found
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: "https://github.com/owner/repo/pull/123",
			sessionUrl: "https://claude.ai/code/session-1",
		});
		expect(tabs.activateTab).toHaveBeenCalledWith(10);
		expect(tabs.openNewTab).toHaveBeenCalledTimes(2);
	});

	it("should activate all 3 existing tabs without opening new ones", async () => {
		tabs.findTabByUrl
			.mockResolvedValueOnce(10) // session
			.mockResolvedValueOnce(20) // issue
			.mockResolvedValueOnce(30); // pr
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: "https://github.com/owner/repo/pull/123",
			sessionUrl: "https://claude.ai/code/session-1",
		});
		expect(tabs.activateTab).toHaveBeenCalledTimes(3);
		expect(tabs.openNewTab).not.toHaveBeenCalled();
	});

	it("should use placeholder URL when sessionUrl is null", async () => {
		tabs.findTabByUrl.mockResolvedValue(null);
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: "https://github.com/owner/repo/pull/123",
			sessionUrl: null,
		});
		const calls = tabs.openNewTab.mock.calls.map((c) => String(c[0]));
		const placeholderCall = calls.find((url: string) => url.includes("placeholder.html"));
		expect(placeholderCall).toBeDefined();
		expect(placeholderCall).toContain("type=session");
		expect(placeholderCall).toContain("issue=42");
	});

	it("should use placeholder URL when prUrl is null", async () => {
		tabs.findTabByUrl.mockResolvedValue(null);
		const usecase = createWorkspaceLayoutUseCase(tabs);
		await usecase.openWorkspace({
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: null,
			sessionUrl: "https://claude.ai/code/session-1",
		});
		const calls = tabs.openNewTab.mock.calls.map((c) => String(c[0]));
		const placeholderCall = calls.find((url: string) => url.includes("placeholder.html"));
		expect(placeholderCall).toBeDefined();
		expect(placeholderCall).toContain("type=pr");
		expect(placeholderCall).toContain("issue=42");
	});
});
