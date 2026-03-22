import type { SendMessage } from "../../shared/ports/message.port";

export function createAuthUseCase(sendMessage: SendMessage) {
	async function login(): Promise<void> {
		const response = await sendMessage("AUTH_LOGIN");
		if (!response.ok) {
			throw new Error("Authentication failed. Please try again.");
		}
	}

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

	return { login, logout, checkAuth };
}
