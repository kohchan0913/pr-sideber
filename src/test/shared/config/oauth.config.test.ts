import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Device Flow 対応後の OAuthConfig 型。GREEN フェーズで src/shared/types/auth.ts を書き換え予定。
 * RED フェーズではテスト内にローカル定義して期待する構造を明示する。
 * GREEN フェーズで実型に差し替える際に他テストファイルの重複定義も整理する。
 */
type DeviceFlowOAuthConfig = {
	readonly clientId: string;
	readonly deviceCodeEndpoint: string;
	readonly tokenEndpoint: string;
	readonly scopes: readonly string[];
};

describe("createOAuthConfig", () => {
	beforeEach(() => {
		// dynamic import のモジュールキャッシュを破棄し、各テストで再評価させる
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("should throw when VITE_GITHUB_CLIENT_ID is not set", async () => {
		vi.stubEnv("VITE_GITHUB_CLIENT_ID", "");

		const mod = await import("../../../shared/config/oauth.config");

		// Device Flow 対応後は引数なしになる予定。現在のシグネチャでは引数が必要なため型キャストで呼ぶ。
		const createConfig = mod.createOAuthConfig as unknown as () => DeviceFlowOAuthConfig;
		expect(() => createConfig()).toThrow("VITE_GITHUB_CLIENT_ID is not configured");
	});

	it("should return OAuthConfig with deviceCodeEndpoint when client ID is set", async () => {
		vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");

		const mod = await import("../../../shared/config/oauth.config");
		const createConfig = mod.createOAuthConfig as unknown as () => DeviceFlowOAuthConfig;
		const config = createConfig();

		expect(config).toEqual({
			clientId: "test-client-id",
			deviceCodeEndpoint: "https://github.com/login/device/code",
			tokenEndpoint: "https://github.com/login/oauth/access_token",
			scopes: ["repo"],
		});
	});

	// 以下の not.toHaveProperty テストは toEqual で構造的に保証されているが、
	// Device Flow 移行で「旧プロパティが存在しないこと」を意図として明示するために残す。
	it("should not have clientSecret property", async () => {
		vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");

		const mod = await import("../../../shared/config/oauth.config");
		const createConfig = mod.createOAuthConfig as unknown as () => DeviceFlowOAuthConfig;
		const config = createConfig();

		expect(config).not.toHaveProperty("clientSecret");
	});

	it("should not have authorizationEndpoint property", async () => {
		vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");

		const mod = await import("../../../shared/config/oauth.config");
		const createConfig = mod.createOAuthConfig as unknown as () => DeviceFlowOAuthConfig;
		const config = createConfig();

		expect(config).not.toHaveProperty("authorizationEndpoint");
	});

	it("should not have redirectUri property", async () => {
		vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");

		const mod = await import("../../../shared/config/oauth.config");
		const createConfig = mod.createOAuthConfig as unknown as () => DeviceFlowOAuthConfig;
		const config = createConfig();

		expect(config).not.toHaveProperty("redirectUri");
	});

	it("should have deviceCodeEndpoint pointing to GitHub device code URL", async () => {
		vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");

		const mod = await import("../../../shared/config/oauth.config");
		const createConfig = mod.createOAuthConfig as unknown as () => DeviceFlowOAuthConfig;
		const config = createConfig();

		expect(config.deviceCodeEndpoint).toBe("https://github.com/login/device/code");
	});
});
