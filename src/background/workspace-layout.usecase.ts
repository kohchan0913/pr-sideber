import type { ScreenBounds, WindowManagerPort } from "../domain/ports/window-manager.port";

export interface WorkspaceOpenRequest {
	readonly issueNumber: number;
	readonly issueUrl: string;
	readonly prUrl: string | null;
	readonly sessionUrl: string | null;
}

interface WorkspaceLayout {
	readonly claude: ScreenBounds;
	readonly issue: ScreenBounds;
	readonly pr: ScreenBounds;
}

export function calculateLayout(screen: ScreenBounds): WorkspaceLayout {
	const halfWidth = Math.floor(screen.width / 2);
	const halfHeight = Math.floor(screen.height / 2);

	return {
		claude: {
			left: screen.left,
			top: screen.top,
			width: halfWidth,
			height: screen.height,
		},
		issue: {
			left: screen.left + halfWidth,
			top: screen.top,
			width: screen.width - halfWidth,
			height: halfHeight,
		},
		pr: {
			left: screen.left + halfWidth,
			top: screen.top + halfHeight,
			width: screen.width - halfWidth,
			height: screen.height - halfHeight,
		},
	};
}

function placeholderUrl(type: "pr" | "session", issueNumber: number): string {
	return chrome.runtime.getURL(`placeholder.html?type=${type}&issue=${issueNumber}`);
}

async function openOrReuseWindow(
	url: string,
	queryPattern: string,
	bounds: ScreenBounds,
	wm: WindowManagerPort,
): Promise<void> {
	const existing = await wm.findTab(queryPattern, url);
	if (existing) {
		if (existing.windowTabCount === 1) {
			await wm.moveWindowToBounds(existing.windowId, bounds);
		} else {
			await wm.moveTabToNewWindow(existing.tabId, bounds);
		}
	} else {
		await wm.createWindow(url, bounds);
	}
}

export function createWorkspaceLayoutUseCase(windowManager: WindowManagerPort) {
	return {
		openWorkspace: async (request: WorkspaceOpenRequest): Promise<void> => {
			const screen = await windowManager.getScreenWorkArea();
			const layout = calculateLayout(screen);

			const claudeUrl = request.sessionUrl ?? placeholderUrl("session", request.issueNumber);
			const claudePattern = request.sessionUrl
				? "*://claude.ai/code/*"
				: `chrome-extension://${chrome.runtime.id}/*`;

			const issuePattern = "https://github.com/*/*/issues/*";

			const prUrl = request.prUrl ?? placeholderUrl("pr", request.issueNumber);
			const prPattern = request.prUrl
				? "https://github.com/*/*/pull/*"
				: `chrome-extension://${chrome.runtime.id}/*`;

			await openOrReuseWindow(claudeUrl, claudePattern, layout.claude, windowManager);
			await openOrReuseWindow(request.issueUrl, issuePattern, layout.issue, windowManager);
			await openOrReuseWindow(prUrl, prPattern, layout.pr, windowManager);
		},
	};
}
