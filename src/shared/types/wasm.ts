/** Rust の domain::Greeting に対応する TypeScript 型 */
export interface Greeting {
	message: string;
}

// PR 関連の型は domain 層で定義し、re-export する
export type {
	ApprovalStatus,
	CiStatus,
	MergeableStatus,
	PrItemDto,
	PrListDto,
} from "../../domain/ports/pr-processor.port";
