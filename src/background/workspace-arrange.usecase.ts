import type { ScreenBounds, WindowManagerPort } from "../domain/ports/window-manager.port";
import type { WorkspaceOpenRequest } from "./workspace-layout.usecase";

/** 配置済み判定の許容誤差 (px) */
const POSITION_TOLERANCE = 20;

export interface WorkspaceArrangeSettings {
	readonly getEnabled: () => Promise<boolean>;
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

interface ResourceEntry {
	readonly url: string | null;
	readonly queryPattern: string;
	readonly bounds: ScreenBounds;
}

/** 単一リソースの配置処理 */
async function placeResource(
	resource: ResourceEntry,
	windowManager: WindowManagerPort,
): Promise<void> {
	if (resource.url === null) return;

	const tabInfo = await windowManager.findTab(resource.queryPattern, resource.url);

	if (tabInfo === null) {
		await windowManager.createWindow(resource.url, resource.bounds);
		return;
	}

	if (tabInfo.windowTabCount > 1) {
		await windowManager.moveTabToNewWindow(tabInfo.tabId, resource.bounds);
		return;
	}

	// 単独タブウィンドウ: 配置済みチェック後に移動
	const currentBounds = await windowManager.getWindowBounds(tabInfo.windowId);
	if (isWithinTolerance(currentBounds, resource.bounds)) return;

	await windowManager.moveWindowToBounds(tabInfo.windowId, resource.bounds);
}

export function createWorkspaceArrangeUseCase(
	windowManager: WindowManagerPort,
	settings: WorkspaceArrangeSettings,
) {
	return {
		arrangeWorkspace: async (request: WorkspaceOpenRequest): Promise<void> => {
			const enabled = await settings.getEnabled();
			if (!enabled) return;

			const workArea = await windowManager.getScreenWorkArea();
			const layout = calculateThreePanelLayout(workArea);

			const resources: readonly ResourceEntry[] = [
				{
					url: request.sessionUrl,
					queryPattern: "*://claude.ai/code/*",
					bounds: layout.left,
				},
				{
					url: request.issueUrl,
					queryPattern: "https://github.com/*/*/issues/*",
					bounds: layout.topRight,
				},
				{
					url: request.prUrl,
					queryPattern: "https://github.com/*/*/pull/*",
					bounds: layout.bottomRight,
				},
			];

			for (const resource of resources) {
				await placeResource(resource, windowManager);
			}
		},
	};
}
