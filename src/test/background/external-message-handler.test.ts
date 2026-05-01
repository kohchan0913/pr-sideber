import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExternalMessageHandler } from "../../background/external-message-handler";
import { getChromeMock, resetChromeMock, setupChromeMock } from "../mocks/chrome.mock";

describe("createExternalMessageHandler", () => {
	let mockClaudeSessionWatcher: {
		getSessions: ReturnType<typeof vi.fn>;
	};
	let handler: ReturnType<typeof createExternalMessageHandler>;
	let storageData: Record<string, unknown>;

	beforeEach(() => {
		const chromeMock = setupChromeMock();
		storageData = {};

		chromeMock.storage.local.get.mockImplementation(async (key: string) => {
			return { [key]: storageData[key] };
		});
		chromeMock.tabs.query.mockResolvedValue([{ url: "https://claude.ai/code/session_1" }]);

		mockClaudeSessionWatcher = {
			getSessions: vi.fn().mockResolvedValue({ "10": [] }),
		};
		handler = createExternalMessageHandler(
			mockClaudeSessionWatcher as unknown as Parameters<typeof createExternalMessageHandler>[0],
		);
	});

	afterEach(() => {
		resetChromeMock();
		vi.restoreAllMocks();
	});

	it("claude.ai からの GET_DEBUG_STATE に DebugState で応答する", async () => {
		const sendResponse = vi.fn();
		const sender = { url: "https://claude.ai/code/session_abc" } as chrome.runtime.MessageSender;

		const result = handler({ type: "GET_DEBUG_STATE" }, sender, sendResponse);
		expect(result).toBe(true);

		await vi.waitFor(() => {
			expect(sendResponse).toHaveBeenCalled();
		});

		const response = sendResponse.mock.calls[0][0] as { ok: boolean; data?: unknown };
		expect(response.ok).toBe(true);
		if (response.ok) {
			const data = response.data as { watcherTabCount: number; logs: unknown[] };
			expect(data.watcherTabCount).toBe(1);
			expect(Array.isArray(data.logs)).toBe(true);
		}
	});

	it("不正オリジンを拒否する", () => {
		const sendResponse = vi.fn();
		const sender = { url: "https://evil.com/page" } as chrome.runtime.MessageSender;

		const result = handler({ type: "GET_DEBUG_STATE" }, sender, sendResponse);
		expect(result).toBe(true);

		expect(sendResponse).toHaveBeenCalledWith({
			ok: false,
			error: "Unauthorized origin",
		});
	});

	it("不正メッセージ型を拒否する", () => {
		const sendResponse = vi.fn();
		const sender = { url: "https://claude.ai/code/session_abc" } as chrome.runtime.MessageSender;

		const result = handler({ type: "MALICIOUS_TYPE" }, sender, sendResponse);
		expect(result).toBe(true);

		expect(sendResponse).toHaveBeenCalledWith({
			ok: false,
			error: "Unsupported message type",
		});
	});

	it("null メッセージを拒否する", () => {
		const sendResponse = vi.fn();
		const sender = { url: "https://claude.ai/code/session_abc" } as chrome.runtime.MessageSender;

		const result = handler(null, sender, sendResponse);
		expect(result).toBe(true);

		expect(sendResponse).toHaveBeenCalledWith({
			ok: false,
			error: "Unsupported message type",
		});
	});

	it("内部エラー時にエラーレスポンスを返す", async () => {
		mockClaudeSessionWatcher.getSessions.mockRejectedValue(new Error("Storage broke"));
		const sendResponse = vi.fn();
		const sender = { url: "https://claude.ai/code/session_abc" } as chrome.runtime.MessageSender;

		handler({ type: "GET_DEBUG_STATE" }, sender, sendResponse);

		await vi.waitFor(() => {
			expect(sendResponse).toHaveBeenCalled();
		});

		const response = sendResponse.mock.calls[0][0] as { ok: boolean; error?: string };
		expect(response.ok).toBe(false);
		expect(response.error).toContain("Storage broke");
	});
});
