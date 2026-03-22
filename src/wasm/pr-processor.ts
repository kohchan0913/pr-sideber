import { processPullRequests as wasmProcessPullRequests } from "../../rust-core/crates/adapter-wasm/pkg/adapter_wasm.js";
import type {
	PrProcessorPort,
	ProcessedPrsResult,
} from "../domain/ports/pr-processor.port";

export class WasmPrProcessor implements PrProcessorPort {
	processPullRequests(rawJson: string): ProcessedPrsResult {
		const result = wasmProcessPullRequests(rawJson) as ProcessedPrsResult;
		return result;
	}
}
