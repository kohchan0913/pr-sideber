import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeIdentityAdapter } from "../../../adapter/chrome/identity.adapter";
import type { StoragePort } from "../../../domain/ports/storage.port";
import type { AuthToken } from "../../../shared/types/auth";
import { AuthError } from "../../../shared/types/auth";
import { getChromeMock, resetChromeMock, setupChromeMock } from "../../mocks/chrome.mock";

/**
 * Device Flow で導入される型。GREEN フェーズで src/shared/types/auth.ts に定義予定。
 * RED フェーズではテスト内にローカル定義して期待する構造を明示する。
 * GREEN フェーズで実型に差し替える際に他テストファイルの重複定義も整理する。
 */
type DeviceCodeResponse = {
	readonly deviceCode: string;
	readonly userCode: string;
	readonly verificationUri: string;
	readonly expiresIn: number;
	readonly interval: number;
};

/**
 * Device Flow 対応後の OAuthConfig。clientSecret / authorizationEndpoint / redirectUri が消え、
 * deviceCodeEndpoint が追加される。
 */
type DeviceFlowOAuthConfig = {
	readonly clientId: string;
	readonly deviceCodeEndpoint: string;
	readonly tokenEndpoint: string;
	readonly scopes: readonly string[];
};

function createMockStorage(): StoragePort & {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	remove: ReturnType<typeof vi.fn>;
} {
	return {
		get: vi.fn(),
		set: vi.fn(),
		remove: vi.fn(),
	};
}

const TEST_CONFIG: DeviceFlowOAuthConfig = {
	clientId: "test-client-id",
	deviceCodeEndpoint: "https://github.com/login/device/code",
	tokenEndpoint: "https://github.com/login/oauth/access_token",
	scopes: ["repo"],
};

const MOCK_TOKEN: AuthToken = {
	accessToken: "gho_test_access_token",
	tokenType: "bearer",
	scope: "repo",
};

const MOCK_DEVICE_CODE_RESPONSE: DeviceCodeResponse = {
	deviceCode: "3584d83530557fdd1f46af8289938c8ef79f9dc5",
	userCode: "WDJB-MJHT",
	verificationUri: "https://github.com/login/device",
	expiresIn: 900,
	interval: 5,
};

describe("ChromeIdentityAdapter — Device Flow", () => {
	let adapter: ChromeIdentityAdapter;
	let mockStorage: ReturnType<typeof createMockStorage>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		setupChromeMock();
		mockStorage = createMockStorage();
		mockStorage.set.mockResolvedValue(undefined);
		mockStorage.remove.mockResolvedValue(undefined);
		// Device Flow 対応後の config を渡す。現在の OAuthConfig 型とは合わないが RED フェーズでは意図的。
		adapter = new ChromeIdentityAdapter(mockStorage, TEST_CONFIG as never);
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		resetChromeMock();
		globalThis.fetch = originalFetch;
	});

	describe("requestDeviceCode", () => {
		it("should POST to deviceCodeEndpoint with client_id and scope, and return DeviceCodeResponse with camelCase fields", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					device_code: MOCK_DEVICE_CODE_RESPONSE.deviceCode,
					user_code: MOCK_DEVICE_CODE_RESPONSE.userCode,
					verification_uri: MOCK_DEVICE_CODE_RESPONSE.verificationUri,
					expires_in: MOCK_DEVICE_CODE_RESPONSE.expiresIn,
					interval: MOCK_DEVICE_CODE_RESPONSE.interval,
				}),
			});

			// requestDeviceCode はまだ存在しないメソッド。RED フェーズで失敗する。
			const result: DeviceCodeResponse = await (
				adapter as never as {
					requestDeviceCode(): Promise<DeviceCodeResponse>;
				}
			).requestDeviceCode();

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			expect(fetchMock).toHaveBeenCalledWith(
				TEST_CONFIG.deviceCodeEndpoint,
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Accept: "application/json",
					}),
				}),
			);

			const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			const body = options.body as string;
			expect(body).toContain("client_id=test-client-id");
			expect(body).toContain("scope=repo");

			expect(result).toEqual(MOCK_DEVICE_CODE_RESPONSE);
		});

		/**
		 * GREEN フェーズで AuthErrorCode に以下を追加予定:
		 * - "device_code_request_failed"
		 * - "device_flow_expired"
		 * - "device_flow_denied"
		 */
		it("should throw AuthError when API returns HTTP error", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});

			const error = await (
				adapter as never as {
					requestDeviceCode(): Promise<DeviceCodeResponse>;
				}
			)
				.requestDeviceCode()
				.catch((e: unknown) => e);
			expect(error).toBeInstanceOf(AuthError);
			expect((error as AuthError).code).toBe("device_code_request_failed");
		});

		it("should throw AuthError when fetch rejects with network error", async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

			const error = await (
				adapter as never as {
					requestDeviceCode(): Promise<DeviceCodeResponse>;
				}
			)
				.requestDeviceCode()
				.catch((e: unknown) => e);
			expect(error).toBeInstanceOf(AuthError);
			expect((error as AuthError).code).toBe("device_code_request_failed");
			expect((error as AuthError).message).toBe("Device code request failed");
		});
	});

	describe("pollForToken", () => {
		it("should return PollResult with success status when token is returned", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					// eslint-disable-next-line @typescript-eslint/naming-convention
					access_token: MOCK_TOKEN.accessToken,
					token_type: MOCK_TOKEN.tokenType,
					scope: MOCK_TOKEN.scope,
				}),
			});

			const result = await adapter.pollForToken(MOCK_DEVICE_CODE_RESPONSE.deviceCode);

			expect(result).toEqual({ status: "success", token: MOCK_TOKEN });
		});

		it("should save the token via StoragePort on success", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					access_token: MOCK_TOKEN.accessToken,
					token_type: MOCK_TOKEN.tokenType,
					scope: MOCK_TOKEN.scope,
				}),
			});

			await adapter.pollForToken(MOCK_DEVICE_CODE_RESPONSE.deviceCode);

			expect(mockStorage.set).toHaveBeenCalledWith("github_auth_token", MOCK_TOKEN);
		});

		it("should return pending status when authorization_pending", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ error: "authorization_pending" }),
			});

			const result = await adapter.pollForToken(MOCK_DEVICE_CODE_RESPONSE.deviceCode);

			expect(result).toEqual({ status: "pending" });
		});

		it("should return slow_down status with new interval", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ error: "slow_down", interval: 10 }),
			});

			const result = await adapter.pollForToken(MOCK_DEVICE_CODE_RESPONSE.deviceCode);

			expect(result).toEqual({ status: "slow_down", interval: 10 });
		});

		it("should return expired status when expired_token", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ error: "expired_token" }),
			});

			const result = await adapter.pollForToken(MOCK_DEVICE_CODE_RESPONSE.deviceCode);

			expect(result).toEqual({ status: "expired" });
		});

		it("should return denied status when access_denied", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ error: "access_denied" }),
			});

			const result = await adapter.pollForToken(MOCK_DEVICE_CODE_RESPONSE.deviceCode);

			expect(result).toEqual({ status: "denied" });
		});

		it("should throw AuthError when fetch rejects with network error", async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Network error"));

			const error = await adapter.pollForToken(
				MOCK_DEVICE_CODE_RESPONSE.deviceCode,
			).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(AuthError);
			expect((error as AuthError).code).toBe("token_exchange_failed");
		});

		it("should throw AuthError when HTTP response is not ok", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
			});

			const error = await adapter.pollForToken(
				MOCK_DEVICE_CODE_RESPONSE.deviceCode,
			).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(AuthError);
			expect((error as AuthError).code).toBe("token_exchange_failed");
		});

		it("should POST to tokenEndpoint with correct grant_type and device_code", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					access_token: MOCK_TOKEN.accessToken,
					token_type: MOCK_TOKEN.tokenType,
					scope: MOCK_TOKEN.scope,
				}),
			});

			await adapter.pollForToken(MOCK_DEVICE_CODE_RESPONSE.deviceCode);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			expect(fetchMock).toHaveBeenCalledWith(
				TEST_CONFIG.tokenEndpoint,
				expect.objectContaining({ method: "POST" }),
			);
			const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			const body = options.body as string;
			expect(body).toContain("client_id=test-client-id");
			expect(body).toContain("device_code=");
			expect(body).toContain("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code");
		});
	});

	describe("getToken", () => {
		it("should retrieve saved token from StoragePort", async () => {
			mockStorage.get.mockResolvedValue(MOCK_TOKEN);

			const result = await adapter.getToken();

			expect(mockStorage.get).toHaveBeenCalledWith("github_auth_token");
			expect(result).toEqual(MOCK_TOKEN);
		});

		it("should return null when no token is saved", async () => {
			mockStorage.get.mockResolvedValue(null);

			const result = await adapter.getToken();

			expect(result).toBeNull();
		});
	});

	describe("clearToken", () => {
		it("should remove token from StoragePort", async () => {
			await adapter.clearToken();

			expect(mockStorage.remove).toHaveBeenCalledWith("github_auth_token");
		});
	});

	describe("isAuthenticated", () => {
		it("should return true when token exists", async () => {
			mockStorage.get.mockResolvedValue(MOCK_TOKEN);

			const result = await adapter.isAuthenticated();

			expect(result).toBe(true);
		});

		it("should return false when no token exists", async () => {
			mockStorage.get.mockResolvedValue(null);

			const result = await adapter.isAuthenticated();

			expect(result).toBe(false);
		});
	});
});
