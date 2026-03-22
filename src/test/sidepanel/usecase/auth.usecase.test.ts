import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendMessage } from "../../../shared/ports/message.port";
import type { ResponseMessage } from "../../../shared/types/messages";
import { createAuthUseCase } from "../../../sidepanel/usecase/auth.usecase";

describe("auth usecase", () => {
	let mockSendMessage: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockSendMessage = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("login", () => {
		it("should send AUTH_LOGIN message and resolve on success", async () => {
			const response: ResponseMessage<"AUTH_LOGIN"> = { ok: true, data: undefined };
			mockSendMessage.mockResolvedValue(response);

			const { login } = createAuthUseCase(mockSendMessage as SendMessage);
			await login();

			expect(mockSendMessage).toHaveBeenCalledWith("AUTH_LOGIN");
		});

		it("should throw when response is not ok", async () => {
			const response: ResponseMessage<"AUTH_LOGIN"> = {
				ok: false,
				error: { code: "AUTH_LOGIN_ERROR", message: "Login failed" },
			};
			mockSendMessage.mockResolvedValue(response);

			const { login } = createAuthUseCase(mockSendMessage as SendMessage);
			await expect(login()).rejects.toThrow("Authentication failed. Please try again.");
		});

		it("should throw when sendMessage rejects", async () => {
			mockSendMessage.mockRejectedValue(new Error("Extension context invalidated"));

			const { login } = createAuthUseCase(mockSendMessage as SendMessage);
			await expect(login()).rejects.toThrow("Extension context invalidated");
		});
	});

	describe("logout", () => {
		it("should send AUTH_LOGOUT message and resolve on success", async () => {
			const response: ResponseMessage<"AUTH_LOGOUT"> = { ok: true, data: undefined };
			mockSendMessage.mockResolvedValue(response);

			const { logout } = createAuthUseCase(mockSendMessage as SendMessage);
			await logout();

			expect(mockSendMessage).toHaveBeenCalledWith("AUTH_LOGOUT");
		});

		it("should throw when response is not ok", async () => {
			const response: ResponseMessage<"AUTH_LOGOUT"> = {
				ok: false,
				error: { code: "AUTH_LOGOUT_ERROR", message: "Logout failed" },
			};
			mockSendMessage.mockResolvedValue(response);

			const { logout } = createAuthUseCase(mockSendMessage as SendMessage);
			await expect(logout()).rejects.toThrow("Logout failed. Please try again.");
		});
	});

	describe("checkAuth", () => {
		it("should return true when authenticated", async () => {
			const response: ResponseMessage<"AUTH_STATUS"> = {
				ok: true,
				data: { isAuthenticated: true },
			};
			mockSendMessage.mockResolvedValue(response);

			const { checkAuth } = createAuthUseCase(mockSendMessage as SendMessage);
			const result = await checkAuth();

			expect(result).toBe(true);
			expect(mockSendMessage).toHaveBeenCalledWith("AUTH_STATUS");
		});

		it("should return false when not authenticated", async () => {
			const response: ResponseMessage<"AUTH_STATUS"> = {
				ok: true,
				data: { isAuthenticated: false },
			};
			mockSendMessage.mockResolvedValue(response);

			const { checkAuth } = createAuthUseCase(mockSendMessage as SendMessage);
			const result = await checkAuth();

			expect(result).toBe(false);
		});

		it("should return false when response is not ok", async () => {
			const response: ResponseMessage<"AUTH_STATUS"> = {
				ok: false,
				error: { code: "AUTH_STATUS_ERROR", message: "Failed to check authentication status" },
			};
			mockSendMessage.mockResolvedValue(response);

			const { checkAuth } = createAuthUseCase(mockSendMessage as SendMessage);
			const result = await checkAuth();

			expect(result).toBe(false);
		});

		it("should return false when sendMessage rejects", async () => {
			mockSendMessage.mockRejectedValue(new Error("Extension context invalidated"));

			const { checkAuth } = createAuthUseCase(mockSendMessage as SendMessage);
			const result = await checkAuth();

			expect(result).toBe(false);
		});
	});
});
