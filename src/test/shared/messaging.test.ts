import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChromeMock, resetChromeMock, setupChromeMock } from "../mocks/chrome.mock";

describe("sendMessage", () => {
	beforeEach(() => {
		vi.resetModules();
		setupChromeMock();
	});

	afterEach(() => {
		resetChromeMock();
	});

	it("should call chrome.runtime.sendMessage with correct type", async () => {
		const mock = getChromeMock();
		mock.runtime.sendMessage.mockImplementation(
			(_message: unknown, callback: (response: unknown) => void) => {
				callback({ ok: true, data: { isAuthenticated: true } });
			},
		);

		const { sendMessage } = await import("../../shared/messaging");
		await sendMessage("AUTH_STATUS");

		expect(mock.runtime.sendMessage).toHaveBeenCalledWith(
			{ type: "AUTH_STATUS" },
			expect.any(Function),
		);
	});

	it("should return ok: true response as-is", async () => {
		const mock = getChromeMock();
		mock.runtime.sendMessage.mockImplementation(
			(_message: unknown, callback: (response: unknown) => void) => {
				callback({ ok: true, data: undefined });
			},
		);

		const { sendMessage } = await import("../../shared/messaging");
		const result = await sendMessage("AUTH_LOGOUT");

		expect(result).toEqual({ ok: true, data: undefined });
	});

	it("should return ok: false response as-is without throwing", async () => {
		const mock = getChromeMock();
		mock.runtime.sendMessage.mockImplementation(
			(_message: unknown, callback: (response: unknown) => void) => {
				callback({ ok: false, error: { code: "AUTH_LOGOUT_ERROR", message: "Failed" } });
			},
		);

		const { sendMessage } = await import("../../shared/messaging");
		const result = await sendMessage("AUTH_LOGOUT");

		expect(result).toEqual({
			ok: false,
			error: { code: "AUTH_LOGOUT_ERROR", message: "Failed" },
		});
	});

	it("should return ok: false when chrome.runtime.lastError is set", async () => {
		const mock = getChromeMock();
		mock.runtime.sendMessage.mockImplementation(
			(_message: unknown, callback: (response: unknown) => void) => {
				mock.runtime.lastError = { message: "Extension context invalidated" };
				callback(undefined);
			},
		);

		const { sendMessage } = await import("../../shared/messaging");
		const result = await sendMessage("AUTH_STATUS");

		expect(result).toEqual({
			ok: false,
			error: { code: "RUNTIME_ERROR", message: "Extension context invalidated" },
		});

		// cleanup
		mock.runtime.lastError = undefined;
	});

	it("should return ok: false with default message when lastError has no message", async () => {
		const mock = getChromeMock();
		mock.runtime.sendMessage.mockImplementation(
			(_message: unknown, callback: (response: unknown) => void) => {
				mock.runtime.lastError = {} as chrome.runtime.LastError;
				callback(undefined);
			},
		);

		const { sendMessage } = await import("../../shared/messaging");
		const result = await sendMessage("AUTH_LOGOUT");

		expect(result).toEqual({
			ok: false,
			error: { code: "RUNTIME_ERROR", message: "Unknown runtime error" },
		});

		// cleanup
		mock.runtime.lastError = undefined;
	});

	it("should return NO_RESPONSE when response is undefined without lastError", async () => {
		const mock = getChromeMock();
		mock.runtime.sendMessage.mockImplementation(
			(_message: unknown, callback: (response: unknown) => void) => {
				callback(undefined);
			},
		);

		const { sendMessage } = await import("../../shared/messaging");
		const result = await sendMessage("AUTH_STATUS");

		expect(result).toEqual({
			ok: false,
			error: { code: "NO_RESPONSE", message: "No response from background" },
		});
	});
});
