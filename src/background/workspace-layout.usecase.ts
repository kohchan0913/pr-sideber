export interface WorkspaceOpenRequest {
	readonly issueNumber: number;
	readonly issueUrl: string;
	readonly prUrl: string | null;
	readonly sessionUrl: string | null;
}

/** タブ操作に必要な最小インターフェース */
export interface WorkspaceTabOps {
	readonly findTabByUrl: (queryPattern: string, matchUrl: string) => Promise<number | null>;
	readonly activateTab: (tabId: number) => Promise<void>;
	readonly openNewTab: (url: string) => Promise<void>;
}

function placeholderUrl(type: "pr" | "session", issueNumber: number): string {
	return chrome.runtime.getURL(`placeholder.html?type=${type}&issue=${issueNumber}`);
}

/**
 * URL に一致する既存タブを探してフォーカス。なければ新しいタブとして開く。
 * ウィンドウの作成・移動・リサイズは一切行わない。
 */
async function focusOrOpenTab(
	url: string,
	queryPattern: string,
	tabs: WorkspaceTabOps,
): Promise<void> {
	const existingTabId = await tabs.findTabByUrl(queryPattern, url);
	if (existingTabId !== null) {
		await tabs.activateTab(existingTabId);
	} else {
		await tabs.openNewTab(url);
	}
}

export function createWorkspaceLayoutUseCase(tabs: WorkspaceTabOps) {
	return {
		openWorkspace: async (request: WorkspaceOpenRequest): Promise<void> => {
			const claudeUrl = request.sessionUrl ?? placeholderUrl("session", request.issueNumber);
			const claudePattern = request.sessionUrl
				? "*://claude.ai/code/*"
				: `chrome-extension://${chrome.runtime.id}/*`;

			const issuePattern = "https://github.com/*/*/issues/*";

			const prUrl = request.prUrl ?? placeholderUrl("pr", request.issueNumber);
			const prPattern = request.prUrl
				? "https://github.com/*/*/pull/*"
				: `chrome-extension://${chrome.runtime.id}/*`;

			await focusOrOpenTab(claudeUrl, claudePattern, tabs);
			await focusOrOpenTab(request.issueUrl, issuePattern, tabs);
			await focusOrOpenTab(prUrl, prPattern, tabs);
		},
	};
}
