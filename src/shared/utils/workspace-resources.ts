import type { TreeNodeDto } from "../../domain/ports/epic-processor.port";

export interface WorkspaceResources {
	readonly issueNumber: number;
	readonly issueUrl: string;
	readonly prUrl: string | null;
	readonly sessionUrl: string | null;
}

interface MutableResult {
	prUrl: string | null;
	sessionUrl: string | null;
}

/** ツリーを再帰的に探索して最初の PR と Session を見つける */
function findResources(node: TreeNodeDto, result: MutableResult): void {
	for (const child of node.children) {
		if (result.prUrl === null && child.kind.type === "pullRequest") {
			result.prUrl = child.kind.url;
		}
		if (result.sessionUrl === null && child.kind.type === "session") {
			result.sessionUrl = child.kind.url;
		}
		if (result.prUrl !== null && result.sessionUrl !== null) return;
		findResources(child, result);
		if (result.prUrl !== null && result.sessionUrl !== null) return;
	}
}

/**
 * Issue ノードの子孫から PR URL と Claude Session URL を再帰的に抽出する。
 * 複数ある場合はツリー内の最初のものを選択する。
 */
export function resolveWorkspaceResources(issueNode: TreeNodeDto): WorkspaceResources {
	if (issueNode.kind.type !== "issue") {
		throw new Error(`Expected issue node, got ${issueNode.kind.type}`);
	}

	const result: MutableResult = { prUrl: null, sessionUrl: null };
	findResources(issueNode, result);

	return {
		issueNumber: issueNode.kind.number,
		issueUrl: issueNode.kind.url,
		prUrl: result.prUrl,
		sessionUrl: result.sessionUrl,
	};
}
