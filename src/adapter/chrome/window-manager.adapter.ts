import type {
	ScreenBounds,
	TabInfo,
	WindowManagerPort,
} from "../../domain/ports/window-manager.port";

export class WindowManagerAdapter implements WindowManagerPort {
	async getScreenWorkArea(): Promise<ScreenBounds> {
		return new Promise<ScreenBounds>((resolve) => {
			chrome.system.display.getInfo((displays) => {
				const primary = displays[0];
				resolve({
					left: primary.workArea.left,
					top: primary.workArea.top,
					width: primary.workArea.width,
					height: primary.workArea.height,
				});
			});
		});
	}

	async findTab(queryPattern: string, matchUrl: string): Promise<TabInfo | null> {
		const tabs = await chrome.tabs.query({ url: queryPattern });
		for (const tab of tabs) {
			if (tab.id == null || tab.windowId == null || !tab.url) continue;
			if (!tab.url.startsWith(matchUrl)) continue;

			const windowTabs = await chrome.tabs.query({ windowId: tab.windowId });
			return {
				tabId: tab.id,
				windowId: tab.windowId,
				windowTabCount: windowTabs.length,
			};
		}
		return null;
	}

	async createWindow(url: string, bounds: ScreenBounds): Promise<void> {
		await chrome.windows.create({
			url,
			left: bounds.left,
			top: bounds.top,
			width: bounds.width,
			height: bounds.height,
			focused: false,
		});
	}

	async moveWindowToBounds(windowId: number, bounds: ScreenBounds): Promise<void> {
		await chrome.windows.update(windowId, {
			left: bounds.left,
			top: bounds.top,
			width: bounds.width,
			height: bounds.height,
			state: "normal",
		});
	}

	async moveTabToNewWindow(tabId: number, bounds: ScreenBounds): Promise<void> {
		await chrome.windows.create({
			tabId,
			left: bounds.left,
			top: bounds.top,
			width: bounds.width,
			height: bounds.height,
			focused: false,
		});
	}
}
