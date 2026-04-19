import type { EpicTreeDto, TreeNodeDto } from "../../domain/ports/epic-processor.port";

/**
 * ツリーから指定 Issue 番号に一致するノード (epic / issue / pullRequest) を DFS で検索する。
 * session ノードは検索対象外 (issueNumber は親 Issue への参照であり Issue 本体ではないため)。
 *
 * 純粋関数: 入力ツリーは変更しない。該当なしは null を返す。
 */
export function findNodeInTree(tree: EpicTreeDto, issueNumber: number): TreeNodeDto | null {
	return findInNodes(tree.roots, issueNumber);
}

function findInNodes(nodes: readonly TreeNodeDto[], num: number): TreeNodeDto | null {
	for (const node of nodes) {
		if (matches(node, num)) return node;
		const child = findInNodes(node.children, num);
		if (child) return child;
	}
	return null;
}

function matches(node: TreeNodeDto, num: number): boolean {
	const kind = node.kind;
	if (kind.type === "epic" || kind.type === "issue" || kind.type === "pullRequest") {
		return kind.number === num;
	}
	return false;
}

/**
 * ノードの種別と番号から DOM 上の data 属性として使うキーを生成する。
 * TreeNode.svelte の #each キーと揃えて querySelector で特定可能にする。
 */
export function nodeKeyFor(kind: TreeNodeDto["kind"]): string {
	if (kind.type === "epic") return `epic-${kind.number}`;
	if (kind.type === "issue") return `issue-${kind.number}`;
	if (kind.type === "pullRequest") return `pr-${kind.number}`;
	return `session-${kind.issueNumber}-${kind.url}`;
}
