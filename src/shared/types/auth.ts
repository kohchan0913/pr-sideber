export type OAuthConfig = {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly authorizationEndpoint: string;
	readonly tokenEndpoint: string;
	readonly redirectUri: string;
	readonly scopes: readonly string[];
};

export type AuthToken = {
	readonly accessToken: string;
	readonly tokenType: string;
	readonly scope: string;
	readonly expiresAt?: number;
	readonly refreshToken?: string;
};

export function isAuthToken(value: unknown): value is AuthToken {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const obj = value as Record<string, unknown>;
	return (
		typeof obj.accessToken === "string" &&
		obj.accessToken !== "" &&
		typeof obj.tokenType === "string" &&
		obj.tokenType !== "" &&
		typeof obj.scope === "string"
	);
}

export type AuthErrorCode =
	| "authorization_failed"
	| "token_exchange_failed"
	| "csrf_mismatch"
	| "user_cancelled";

export class AuthError extends Error {
	readonly code: AuthErrorCode;
	constructor(code: AuthErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "AuthError";
		this.code = code;
	}
}
