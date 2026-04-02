import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type WorkspaceArrangeSettings,
	calculateThreePanelLayout,
	createWorkspaceArrangeUseCase,
} from "../../background/workspace-arrange.usecase";
import type { WorkspaceOpenRequest } from "../../background/workspace-layout.usecase";
import type {
	ScreenBounds,
	TabInfo,
	WindowManagerPort,
} from "../../domain/ports/window-manager.port";
import { resetChromeMock, setupChromeMock } from "../mocks/chrome.mock";

// --- helpers ---

function createMockWindowManager(): {
	[K in keyof WindowManagerPort]: ReturnType<typeof vi.fn>;
} {
	return {
		getScreenWorkArea: vi.fn(),
		findTab: vi.fn(),
		getWindowBounds: vi.fn(),
		createWindow: vi.fn(),
		moveWindowToBounds: vi.fn(),
		moveTabToNewWindow: vi.fn(),
	};
}

function createMockSettings(enabled = true): WorkspaceArrangeSettings {
	return { getEnabled: vi.fn().mockResolvedValue(enabled) };
}

/** 1920x1080 フル HD ワークエリア (タスクバー 40px 下) */
const FULL_HD_WORK_AREA: ScreenBounds = {
	left: 0,
	top: 0,
	width: 1920,
	height: 1040,
};

const SAMPLE_REQUEST: WorkspaceOpenRequest = {
	issueNumber: 42,
	issueUrl: "https://github.com/owner/repo/issues/42",
	prUrl: "https://github.com/owner/repo/pull/123",
	sessionUrl: "https://claude.ai/code/session-1",
};

// --- calculateThreePanelLayout ---

describe("calculateThreePanelLayout", () => {
	it("should calculate correct 3-panel bounds for a standard monitor", () => {
		const layout = calculateThreePanelLayout(FULL_HD_WORK_AREA);

		// 左半分: Claude Code Web (session)
		expect(layout.left).toEqual({
			left: 0,
			top: 0,
			width: 960,
			height: 1040,
		});

		// 右上: Issue
		expect(layout.topRight).toEqual({
			left: 960,
			top: 0,
			width: 960,
			height: 520,
		});

		// 右下: PR
		expect(layout.bottomRight).toEqual({
			left: 960,
			top: 520,
			width: 960,
			height: 520,
		});
	});

	it("should handle odd pixel dimensions with Math.round", () => {
		const oddWorkArea: ScreenBounds = {
			left: 0,
			top: 0,
			width: 1921,
			height: 1041,
		};
		const layout = calculateThreePanelLayout(oddWorkArea);

		// 幅 1921 / 2 = 960.5 → Math.round → 961
		expect(layout.left.width).toBe(961);
		expect(layout.topRight.left).toBe(961);
		expect(layout.topRight.width).toBe(961);

		// 高さ 1041 / 2 = 520.5 → Math.round → 521
		expect(layout.topRight.height).toBe(521);
		expect(layout.bottomRight.top).toBe(521);
		expect(layout.bottomRight.height).toBe(521);
	});
});

// --- createWorkspaceArrangeUseCase ---

describe("createWorkspaceArrangeUseCase", () => {
	let wm: ReturnType<typeof createMockWindowManager>;

	beforeEach(() => {
		setupChromeMock();
		wm = createMockWindowManager();
		wm.getScreenWorkArea.mockResolvedValue(FULL_HD_WORK_AREA);
		wm.createWindow.mockResolvedValue(undefined);
		wm.moveWindowToBounds.mockResolvedValue(undefined);
		wm.moveTabToNewWindow.mockResolvedValue(undefined);
		// デフォルト: ウィンドウは遠い位置にある（配置済み判定に引っかからない）
		wm.getWindowBounds.mockResolvedValue({ left: 9999, top: 9999, width: 100, height: 100 });
	});

	afterEach(() => {
		resetChromeMock();
	});

	it("should move 3 single-tab windows to correct positions", async () => {
		// 各タブが見つかり、それぞれのウィンドウにはタブ1つだけ
		// findTab 呼び出し順: session → issue → pr
		wm.findTab
			.mockResolvedValueOnce({ tabId: 1, windowId: 10, windowTabCount: 1 } satisfies TabInfo) // session
			.mockResolvedValueOnce({ tabId: 2, windowId: 20, windowTabCount: 1 } satisfies TabInfo) // issue
			.mockResolvedValueOnce({ tabId: 3, windowId: 30, windowTabCount: 1 } satisfies TabInfo); // pr

		const usecase = createWorkspaceArrangeUseCase(wm, createMockSettings());
		await usecase.arrangeWorkspace(SAMPLE_REQUEST);

		expect(wm.moveWindowToBounds).toHaveBeenCalledTimes(3);
		// session (windowId=10) → left bounds
		expect(wm.moveWindowToBounds).toHaveBeenNthCalledWith(1, 10, {
			left: 0,
			top: 0,
			width: 960,
			height: 1040,
		});
		// issue (windowId=20) → topRight bounds
		expect(wm.moveWindowToBounds).toHaveBeenNthCalledWith(2, 20, {
			left: 960,
			top: 0,
			width: 960,
			height: 520,
		});
		// pr (windowId=30) → bottomRight bounds
		expect(wm.moveWindowToBounds).toHaveBeenNthCalledWith(3, 30, {
			left: 960,
			top: 520,
			width: 960,
			height: 520,
		});
		expect(wm.createWindow).not.toHaveBeenCalled();
		expect(wm.moveTabToNewWindow).not.toHaveBeenCalled();
	});

	it("should create new windows when tabs are not found", async () => {
		wm.findTab.mockResolvedValue(null);

		const usecase = createWorkspaceArrangeUseCase(wm, createMockSettings());
		await usecase.arrangeWorkspace(SAMPLE_REQUEST);

		expect(wm.createWindow).toHaveBeenCalledTimes(3);
		// session → left bounds
		expect(wm.createWindow).toHaveBeenNthCalledWith(1, "https://claude.ai/code/session-1", {
			left: 0,
			top: 0,
			width: 960,
			height: 1040,
		});
		// issue → topRight bounds
		expect(wm.createWindow).toHaveBeenNthCalledWith(2, "https://github.com/owner/repo/issues/42", {
			left: 960,
			top: 0,
			width: 960,
			height: 520,
		});
		// pr → bottomRight bounds
		expect(wm.createWindow).toHaveBeenNthCalledWith(3, "https://github.com/owner/repo/pull/123", {
			left: 960,
			top: 520,
			width: 960,
			height: 520,
		});
		expect(wm.moveWindowToBounds).not.toHaveBeenCalled();
		expect(wm.moveTabToNewWindow).not.toHaveBeenCalled();
	});

	it("should separate tab to new window when window has multiple tabs", async () => {
		// タブが見つかるが、ウィンドウに複数タブがある
		// findTab 呼び出し順: session → issue → pr
		wm.findTab
			.mockResolvedValueOnce({ tabId: 1, windowId: 10, windowTabCount: 5 } satisfies TabInfo) // session
			.mockResolvedValueOnce({ tabId: 2, windowId: 20, windowTabCount: 3 } satisfies TabInfo) // issue
			.mockResolvedValueOnce({ tabId: 3, windowId: 30, windowTabCount: 2 } satisfies TabInfo); // pr

		const usecase = createWorkspaceArrangeUseCase(wm, createMockSettings());
		await usecase.arrangeWorkspace(SAMPLE_REQUEST);

		expect(wm.moveTabToNewWindow).toHaveBeenCalledTimes(3);
		// session (tabId=1) → left bounds
		expect(wm.moveTabToNewWindow).toHaveBeenNthCalledWith(1, 1, {
			left: 0,
			top: 0,
			width: 960,
			height: 1040,
		});
		// issue (tabId=2) → topRight bounds
		expect(wm.moveTabToNewWindow).toHaveBeenNthCalledWith(2, 2, {
			left: 960,
			top: 0,
			width: 960,
			height: 520,
		});
		// pr (tabId=3) → bottomRight bounds
		expect(wm.moveTabToNewWindow).toHaveBeenNthCalledWith(3, 3, {
			left: 960,
			top: 520,
			width: 960,
			height: 520,
		});
		expect(wm.moveWindowToBounds).not.toHaveBeenCalled();
		expect(wm.createWindow).not.toHaveBeenCalled();
	});

	it("should handle mixed scenarios: move, separate, and create", async () => {
		// session: 単独タブウィンドウ → moveWindowToBounds
		// issue: 複数タブウィンドウ → moveTabToNewWindow
		// pr: タブなし → createWindow
		wm.findTab
			.mockResolvedValueOnce({ tabId: 1, windowId: 10, windowTabCount: 1 } satisfies TabInfo) // session
			.mockResolvedValueOnce({ tabId: 2, windowId: 20, windowTabCount: 5 } satisfies TabInfo) // issue
			.mockResolvedValueOnce(null); // pr

		const usecase = createWorkspaceArrangeUseCase(wm, createMockSettings());
		await usecase.arrangeWorkspace(SAMPLE_REQUEST);

		// session (windowId=10) → left bounds via moveWindowToBounds
		expect(wm.moveWindowToBounds).toHaveBeenCalledTimes(1);
		expect(wm.moveWindowToBounds).toHaveBeenNthCalledWith(1, 10, {
			left: 0,
			top: 0,
			width: 960,
			height: 1040,
		});

		// issue (tabId=2) → topRight bounds via moveTabToNewWindow
		expect(wm.moveTabToNewWindow).toHaveBeenCalledTimes(1);
		expect(wm.moveTabToNewWindow).toHaveBeenNthCalledWith(1, 2, {
			left: 960,
			top: 0,
			width: 960,
			height: 520,
		});

		// pr → bottomRight bounds via createWindow
		expect(wm.createWindow).toHaveBeenCalledTimes(1);
		expect(wm.createWindow).toHaveBeenNthCalledWith(1, "https://github.com/owner/repo/pull/123", {
			left: 960,
			top: 520,
			width: 960,
			height: 520,
		});
	});

	it("should skip moving when window is already within tolerance (+-20px)", async () => {
		// ウィンドウが既に目標位置にある（ScreenBounds の各値が +-20px 以内）
		// left パネル: 目標 {left:0, top:0, width:960, height:1040}
		// getScreenWorkArea で返した workArea から計算される位置と一致する場合スキップ

		// findTab で返す windowId のウィンドウが既に正しい位置にあるケースをシミュレート
		// WindowManagerPort には getCurrentBounds がないので、
		// moveWindowToBounds が呼ばれない = スキップ、という検証になる
		// 実装側で何らかの方法でウィンドウの現在位置を知る必要がある
		// ここでは getScreenWorkArea + findTab の情報で判断すると仮定

		// まずは「moveWindowToBounds が呼ばれないこと」を検証する
		// 実装が内部でウィンドウ位置を取得して比較するはず
		wm.findTab
			.mockResolvedValueOnce({ tabId: 1, windowId: 10, windowTabCount: 1 } satisfies TabInfo)
			.mockResolvedValueOnce({ tabId: 2, windowId: 20, windowTabCount: 1 } satisfies TabInfo)
			.mockResolvedValueOnce({ tabId: 3, windowId: 30, windowTabCount: 1 } satisfies TabInfo);

		// getWindowBounds で現在のウィンドウ位置を返す（目標位置と差 10px 以内）
		wm.getWindowBounds
			.mockResolvedValueOnce({ left: 5, top: 3, width: 955, height: 1035 }) // left: 差 <20px
			.mockResolvedValueOnce({ left: 965, top: 5, width: 955, height: 515 }) // topRight: 差 <20px
			.mockResolvedValueOnce({ left: 965, top: 525, width: 955, height: 515 }); // bottomRight: 差 <20px

		const usecase = createWorkspaceArrangeUseCase(wm, createMockSettings());
		await usecase.arrangeWorkspace(SAMPLE_REQUEST);

		// 全ウィンドウが許容範囲内なので移動は発生しない
		expect(wm.moveWindowToBounds).not.toHaveBeenCalled();
	});

	it("should skip resources with null URL", async () => {
		const requestWithNulls: WorkspaceOpenRequest = {
			issueNumber: 42,
			issueUrl: "https://github.com/owner/repo/issues/42",
			prUrl: null,
			sessionUrl: null,
		};

		wm.findTab.mockResolvedValue(null);

		const usecase = createWorkspaceArrangeUseCase(wm, createMockSettings());
		await usecase.arrangeWorkspace(requestWithNulls);

		// session と pr は URL が null なのでスキップ。issue のみ処理される
		expect(wm.findTab).toHaveBeenCalledTimes(1);
		expect(wm.createWindow).toHaveBeenCalledTimes(1);
	});

	it("should do nothing when settings are disabled", async () => {
		const usecase = createWorkspaceArrangeUseCase(wm, createMockSettings(false));
		await usecase.arrangeWorkspace(SAMPLE_REQUEST);

		expect(wm.getScreenWorkArea).not.toHaveBeenCalled();
		expect(wm.findTab).not.toHaveBeenCalled();
		expect(wm.createWindow).not.toHaveBeenCalled();
		expect(wm.moveWindowToBounds).not.toHaveBeenCalled();
		expect(wm.moveTabToNewWindow).not.toHaveBeenCalled();
	});
});
