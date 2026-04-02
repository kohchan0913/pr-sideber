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
	readonly openTabInWindow: (url: string, windowId: number) => Promise<void>;
	readonly findWindowByTabPattern: (queryPattern: string) => Promise<number | null>;
	readonly getCurrentWindowId: () => Promise<number>;
}

/**
 * URL に一致する既存タブを探してフォーカス。なければ適切なウィンドウに新しいタブとして開く。
 * リソースが null ならスキップする。ウィンドウの作成・移動・リサイズは一切行わない。
 */
async function focusOrOpenTab(
	url: string | null,
	queryPattern: string,
	targetWindowPattern: string,
	tabs: WorkspaceTabOps,
): Promise<void> {
	if (url === null) return;

	const existingTabId = await tabs.findTabByUrl(queryPattern, url);
	if (existingTabId !== null) {
		await tabs.activateTab(existingTabId);
		return;
	}

	// 同種のタブがあるウィンドウを探して、そこに新しいタブを開く
	const windowId =
		(await tabs.findWindowByTabPattern(targetWindowPattern)) ?? (await tabs.getCurrentWindowId());
	await tabs.openTabInWindow(url, windowId);
}

export function createWorkspaceLayoutUseCase(tabs: WorkspaceTabOps) {
	return {
		openWorkspace: async (request: WorkspaceOpenRequest): Promise<void> => {
			// Claude → claude.ai タブがあるウィンドウに開く
			await focusOrOpenTab(request.sessionUrl, "*://claude.ai/code/*", "*://claude.ai/*", tabs);

			// Issue → github.com タブがあるウィンドウに開く
			await focusOrOpenTab(
				request.issueUrl,
				"https://github.com/*/*/issues/*",
				"https://github.com/*",
				tabs,
			);

			// PR → github.com タブがあるウィンドウに開く
			await focusOrOpenTab(
				request.prUrl,
				"https://github.com/*/*/pull/*",
				"https://github.com/*",
				tabs,
			);
		},
	};
}
