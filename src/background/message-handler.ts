import type { AppServices } from "./bootstrap";
import type { MessageType, RequestMessage, ResponseMessage } from "../shared/types/messages";
import { isRequestMessage } from "../shared/types/messages";

/** メッセージタイプごとの汎用エラーメッセージ */
const ERROR_MESSAGES: Record<MessageType, string> = {
	AUTH_LOGIN: "Login failed",
	AUTH_LOGOUT: "Logout failed",
	AUTH_STATUS: "Failed to check authentication status",
};

export function createMessageHandler(services: AppServices) {
	return (
		message: unknown,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: ResponseMessage<MessageType>) => void,
	): boolean => {
		// 自拡張以外からのメッセージを拒否
		if (sender.id !== chrome.runtime.id) {
			sendResponse({ ok: false, error: { code: "FORBIDDEN", message: "Untrusted sender" } });
			return false;
		}

		// 未知メッセージにはチャンネルを保持せず即返却
		if (!isRequestMessage(message)) {
			return false;
		}

		handleMessage(services, message, sendResponse);
		return true; // Chrome の非同期レスポンス仕様: true を返して sendResponse を非同期で呼ぶ
	};
}

async function handleMessage(
	services: AppServices,
	message: RequestMessage<MessageType>,
	sendResponse: (response: ResponseMessage<MessageType>) => void,
): Promise<void> {
	try {
		switch (message.type) {
			case "AUTH_LOGIN": {
				await services.auth.authorize();
				sendResponse({ ok: true, data: undefined });
				break;
			}
			case "AUTH_LOGOUT": {
				await services.auth.clearToken();
				sendResponse({ ok: true, data: undefined });
				break;
			}
			case "AUTH_STATUS": {
				const isAuthenticated = await services.auth.isAuthenticated();
				sendResponse({ ok: true, data: { isAuthenticated } });
				break;
			}
			default: {
				const _exhaustive: never = message.type;
				sendResponse({
					ok: false,
					error: { code: "UNHANDLED_MESSAGE", message: `Unhandled message type: ${_exhaustive}` },
				});
				break;
			}
		}
	} catch (err: unknown) {
		if (import.meta.env.DEV) {
			console.error(`[message-handler] ${message.type} error:`, err);
		}
		sendResponse({
			ok: false,
			error: {
				code: `${message.type}_ERROR`,
				message: ERROR_MESSAGES[message.type],
			},
		});
	}
}
