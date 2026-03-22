import type { PrListDto } from "../../../rust-core/crates/adapter-wasm/pkg/adapter_wasm";

export type ProcessedPrsResult = {
	readonly myPrs: PrListDto;
	readonly reviewRequests: PrListDto;
};

export interface PrProcessorPort {
	processPullRequests(rawJson: string): ProcessedPrsResult;
}
