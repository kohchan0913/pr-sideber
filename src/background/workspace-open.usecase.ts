import type { ScreenBounds, WindowManagerPort } from "../domain/ports/window-manager.port";

/** 配置済み判定の許容誤差 (px) */
const POSITION_TOLERANCE = 20;

export interface WorkspaceOpenRequest {
	readonly issueNumber: number;
	readonly issueUrl: string;
	readonly prUrl: string | null;
	readonly sessionUrl: string | null;
	readonly senderWindowId: number;
}

export interface WorkspaceOpenSettings {
	readonly getArrangeEnabled: () => Promise<boolean>;
}

interface ThreePanelLayout {
	readonly left: ScreenBounds;
	readonly topRight: ScreenBounds;
	readonly bottomRight: ScreenBounds;
}

/** 3パネルレイアウトの座標を純粋計算する */
export function calculateThreePanelLayout(workArea: ScreenBounds): ThreePanelLayout {
	const halfWidth = Math.round(workArea.width / 2);
	const halfHeight = Math.round(workArea.height / 2);

	return {
		left: {
			left: workArea.left,
			top: workArea.top,
			width: halfWidth,
			height: workArea.height,
		},
		topRight: {
			left: workArea.left + halfWidth,
			top: workArea.top,
			width: halfWidth,
			height: halfHeight,
		},
		bottomRight: {
			left: workArea.left + halfWidth,
			top: workArea.top + halfHeight,
			width: halfWidth,
			height: halfHeight,
		},
	};
}

/** ウィンドウが目標位置に十分近いか判定する */
function isWithinTolerance(current: ScreenBounds, target: ScreenBounds): boolean {
	return (
		Math.abs(current.left - target.left) <= POSITION_TOLERANCE &&
		Math.abs(current.top - target.top) <= POSITION_TOLERANCE &&
		Math.abs(current.width - target.width) <= POSITION_TOLERANCE &&
		Math.abs(current.height - target.height) <= POSITION_TOLERANCE
	);
}

interface CollectedTab {
	readonly tabId: number;
	readonly windowId: number;
	readonly windowTabCount: number;
}

/** 既存タブを探すか、なければ senderWindowId に新規作成する。タブ情報を返す */
async function findOrCreateTab(
	url: string,
	queryPattern: string,
	senderWindowId: number,
	windowManager: WindowManagerPort,
): Promise<CollectedTab> {
	const existing = await windowManager.findTab(queryPattern, url);
	if (existing !== null) {
		await windowManager.activateTab(existing.tabId);
		return existing;
	}
	const created = await windowManager.createTabInWindow(url, senderWindowId);
	// 作成したタブは senderWindowId にいる（複数タブウィンドウ扱い）
	return { tabId: created.tabId, windowId: senderWindowId, windowTabCount: 2 };
}

/** 収集済みタブ情報を使ってウィンドウを配置する */
async function arrangeTab(
	tab: CollectedTab,
	bounds: ScreenBounds,
	windowManager: WindowManagerPort,
): Promise<void> {
	if (tab.windowTabCount > 1) {
		await windowManager.moveTabToNewWindow(tab.tabId, bounds);
		return;
	}
	const currentBounds = await windowManager.getWindowBounds(tab.windowId);
	if (isWithinTolerance(currentBounds, bounds)) return;
	await windowManager.moveWindowToBounds(tab.windowId, bounds);
}

export function createWorkspaceOpenUseCase(
	windowManager: WindowManagerPort,
	settings: WorkspaceOpenSettings,
) {
	return {
		openWorkspace: async (request: WorkspaceOpenRequest): Promise<void> => {
			const resources = [
				{ url: request.sessionUrl, queryPattern: "*://claude.ai/code/*" },
				{ url: request.issueUrl, queryPattern: "https://github.com/*/*/issues/*" },
				{ url: request.prUrl, queryPattern: "https://github.com/*/*/pull/*" },
			] as const;

			// Step 1: タブを開く/フォーカスする（同じウィンドウ）+ タブ情報を収集
			const tabs: (CollectedTab | null)[] = [];
			for (const resource of resources) {
				if (resource.url === null) {
					tabs.push(null);
					continue;
				}
				const tab = await findOrCreateTab(
					resource.url,
					resource.queryPattern,
					request.senderWindowId,
					windowManager,
				);
				tabs.push(tab);
			}

			// Step 2: 設定が ON なら収集したタブを3分割配置する
			const arrangeEnabled = await settings.getArrangeEnabled();
			if (!arrangeEnabled) return;

			const workArea = await windowManager.getScreenWorkArea();
			const layout = calculateThreePanelLayout(workArea);
			const boundsMap = [layout.left, layout.topRight, layout.bottomRight] as const;

			for (let i = 0; i < tabs.length; i++) {
				const tab = tabs[i];
				if (tab === null) continue;
				await arrangeTab(tab, boundsMap[i], windowManager);
			}
		},
	};
}
