import type { SendMessage } from "../../shared/ports/message.port";
import type { DeviceCodeResponse, PollResult } from "../../shared/types/auth";

/** Side Panel 側のポーリング間隔下限 (秒) */
const MIN_POLL_INTERVAL_SEC = 5;

export type DeviceFlowState =
	| { readonly phase: "idle" }
	| { readonly phase: "awaiting_user"; readonly userCode: string; readonly verificationUri: string }
	| { readonly phase: "polling" }
	| { readonly phase: "success" }
	| { readonly phase: "expired" }
	| { readonly phase: "denied" }
	| { readonly phase: "error"; readonly message: string };

export function createAuthUseCase(sendMessage: SendMessage) {
	async function logout(): Promise<void> {
		const response = await sendMessage("AUTH_LOGOUT");
		if (!response.ok) {
			throw new Error("Logout failed. Please try again.");
		}
	}

	async function checkAuth(): Promise<boolean> {
		try {
			const response = await sendMessage("AUTH_STATUS");
			if (!response.ok) {
				return false;
			}
			return response.data.isAuthenticated;
		} catch {
			return false;
		}
	}

	async function requestDeviceCode(): Promise<DeviceCodeResponse> {
		const response = await sendMessage("AUTH_DEVICE_CODE");
		if (!response.ok) {
			throw new Error(response.error.message);
		}
		return response.data;
	}

	/**
	 * Side Panel 側でポーリングループを制御する。
	 * Background の pollForToken は 1回分の試行のみ行い即座に結果を返す。
	 * Service Worker の30秒キル問題を回避するための設計。
	 */
	async function waitForAuthorization(
		deviceCode: string,
		interval: number,
		expiresIn: number,
		onStateChange?: (state: DeviceFlowState) => void,
	): Promise<void> {
		let currentInterval = Math.max(interval, MIN_POLL_INTERVAL_SEC);
		const deadline = Date.now() + expiresIn * 1000;

		onStateChange?.({ phase: "polling" });

		while (Date.now() < deadline) {
			await wait(currentInterval * 1000);

			if (Date.now() >= deadline) {
				onStateChange?.({ phase: "expired" });
				throw new Error("Device flow expired. Please try again.");
			}

			const response = await sendMessage("AUTH_DEVICE_POLL", { deviceCode });
			if (!response.ok) {
				onStateChange?.({ phase: "error", message: response.error.message });
				throw new Error(response.error.message);
			}

			const result: PollResult = response.data;

			switch (result.status) {
				case "success":
					onStateChange?.({ phase: "success" });
					return;
				case "pending":
					continue;
				case "slow_down":
					currentInterval = Math.max(result.interval, currentInterval + 5);
					continue;
				case "expired":
					onStateChange?.({ phase: "expired" });
					throw new Error("Device flow expired. Please try again.");
				case "denied":
					onStateChange?.({ phase: "denied" });
					throw new Error("Authorization denied by user.");
			}
		}

		onStateChange?.({ phase: "expired" });
		throw new Error("Device flow expired. Please try again.");
	}

	return { logout, checkAuth, requestDeviceCode, waitForAuthorization };
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
