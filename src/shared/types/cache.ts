import type { ProcessedPrsResult } from "../../domain/ports/pr-processor.port";

export const PR_CACHE_KEY = "pr_cache";

export type CachedPrData = {
	readonly data: ProcessedPrsResult & { readonly hasMore: boolean };
	readonly lastUpdatedAt: string;
};

export function isCachedPrData(_value: unknown): _value is CachedPrData {
	throw new Error("Not implemented");
}
