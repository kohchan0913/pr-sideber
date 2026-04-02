export interface ScreenBounds {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface TabInfo {
	readonly tabId: number;
	readonly windowId: number;
	readonly windowTabCount: number;
}

export interface WindowManagerPort {
	/** プライマリモニタの workArea (タスクバー除外) を取得する */
	getScreenWorkArea(): Promise<ScreenBounds>;

	/**
	 * URL が一致するタブを検索する。
	 * @param queryPattern - chrome.tabs.query に渡す URL パターン
	 * @param matchUrl - tab.url が matchUrl で始まるか比較する
	 */
	findTab(queryPattern: string, matchUrl: string): Promise<TabInfo | null>;

	/** 指定 URL と位置で新しいウィンドウを作成する */
	createWindow(url: string, bounds: ScreenBounds): Promise<void>;

	/** 既存ウィンドウを指定位置に移動・リサイズする */
	moveWindowToBounds(windowId: number, bounds: ScreenBounds): Promise<void>;

	/** タブを新しいウィンドウに分離し、指定位置に配置する */
	moveTabToNewWindow(tabId: number, bounds: ScreenBounds): Promise<void>;
}
