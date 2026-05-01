import type { DebugState } from "../shared/types/messages";
import { getDebugEntries } from "../shared/utils/debug-logger";
import type { ClaudeSessionWatcher } from "./claude-session-watcher";

/**
 * claude.ai からの外部メッセージを処理する (externally_connectable)。
 * ホワイトリスト方式で GET_DEBUG_STATE のみ許可する。
 */
export function createExternalMessageHandler(claudeSessionWatcher: ClaudeSessionWatcher) {
	return (
		message: unknown,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: unknown) => void,
	): boolean => {
		if (!sender.url?.startsWith("https://claude.ai/")) {
			sendResponse({ ok: false, error: "Unauthorized origin" });
			return true;
		}
		if (
			typeof message !== "object" ||
			message === null ||
			(message as { type?: string }).type !== "GET_DEBUG_STATE"
		) {
			sendResponse({ ok: false, error: "Unsupported message type" });
			return true;
		}
		(async () => {
			try {
				const claudeSessions = await claudeSessionWatcher.getSessions();
				const logs = await getDebugEntries();
				const tabs = await chrome.tabs.query({ url: "*://claude.ai/code/*" });
				const debugState: DebugState = {
					claudeSessions,
					watcherTabCount: tabs.length,
					logs,
				};
				sendResponse({ ok: true, data: debugState });
			} catch (e: unknown) {
				console.error("[external-message-handler] error:", e);
				sendResponse({ ok: false, error: String(e) });
			}
		})();
		// 非同期レスポンスを返すために true を返す
		return true;
	};
}
