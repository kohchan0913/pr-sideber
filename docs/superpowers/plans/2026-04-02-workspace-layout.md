# ワークスペース自動配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR Sidebar の Issue ノードから ⧉ ボタンで Claude Code Web / Issue / PR を3ウィンドウに自動配置する

**Architecture:** Side Panel で Issue ノードの子ノード (PR, Session) から URL を解決し、`OPEN_WORKSPACE` メッセージで Background に送信。Background の `workspace-layout.usecase` が `WindowManagerPort` 経由で `chrome.windows` / `chrome.system.display` を操作して3ウィンドウを配置する。

**Tech Stack:** TypeScript, Svelte 5, Chrome Extension Manifest V3 (`chrome.windows`, `chrome.system.display`)

**Spec:** `docs/superpowers/specs/2026-04-02-workspace-layout-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/domain/ports/window-manager.port.ts` | ウィンドウ管理の抽象インターフェース |
| `src/adapter/chrome/window-manager.adapter.ts` | `chrome.windows` / `chrome.system.display` ラッパー |
| `src/shared/utils/workspace-resources.ts` | TreeNode から Issue/PR/Session URL を抽出する純粋関数 |
| `src/background/workspace-layout.usecase.ts` | レイアウト計算 + ウィンドウ配置オーケストレーション |
| `public/placeholder.html` | リソース未存在時のプレースホルダーページ |
| `src/test/shared/utils/workspace-resources.test.ts` | workspace-resources テスト |
| `src/test/adapter/chrome/window-manager.adapter.test.ts` | window-manager adapter テスト |
| `src/test/background/workspace-layout.usecase.test.ts` | workspace-layout usecase テスト |

### Modified files

| File | Change |
|------|--------|
| `manifest.config.ts` | `system.display` permission 追加 |
| `src/shared/types/messages.ts` | `OPEN_WORKSPACE` メッセージ型追加 |
| `src/background/message-handler.ts` | `OPEN_WORKSPACE` ハンドラー追加 |
| `src/background/types.ts` | `windowManager` を `AppServices` に追加 |
| `src/background/bootstrap.ts` | `WindowManagerAdapter` を組成 |
| `src/sidepanel/components/TreeNode.svelte` | ⧉ ボタン追加 (ホバー表示) |
| `src/sidepanel/components/EpicSection.svelte` | `onOpenWorkspace` prop 追加 |
| `src/sidepanel/components/MainScreen.svelte` | `onOpenWorkspace` prop 追加 |
| `src/sidepanel/main.ts` | `onOpenWorkspace` コールバック作成・注入 |
| `src/test/mocks/chrome.mock.ts` | `windows.create`, `system.display` モック追加 |

---

## Task 1: Foundation — メッセージ型 + Manifest

**Files:**
- Modify: `manifest.config.ts:8`
- Modify: `src/shared/types/messages.ts`
- Modify: `src/test/mocks/chrome.mock.ts`

- [ ] **Step 1: `manifest.config.ts` に `system.display` permission を追加**

```typescript
permissions: ["sidePanel", "storage", "alarms", "tabs", "system.display"],
```

- [ ] **Step 2: `src/shared/types/messages.ts` に `OPEN_WORKSPACE` を追加**

`MESSAGE_TYPES` 配列に追加:

```typescript
export const MESSAGE_TYPES = [
  "AUTH_LOGOUT",
  "AUTH_STATUS",
  "AUTH_DEVICE_CODE",
  "AUTH_DEVICE_POLL",
  "FETCH_EPIC_TREE",
  "FETCH_ISSUES",
  "FETCH_PRS",
  "UPDATE_BADGE",
  "NAVIGATE_TO_PR",
  "GET_CLAUDE_SESSIONS",
  "OPEN_WORKSPACE",
] as const;
```

`RequestMap` に追加:

```typescript
OPEN_WORKSPACE: {
  issueNumber: number;
  issueUrl: string;
  prUrl: string | null;
  sessionUrl: string | null;
};
```

`ResponseDataMap` に追加:

```typescript
OPEN_WORKSPACE: undefined;
```

- [ ] **Step 3: `src/test/mocks/chrome.mock.ts` にモック追加**

`ChromeMock` 型に追加:

```typescript
windows: {
  update: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};
system: {
  display: {
    getInfo: ReturnType<typeof vi.fn>;
  };
};
```

`ChromeMock` の `runtime` に追加:

```typescript
getURL: ReturnType<typeof vi.fn>;
```

`createChromeMock` 内の `windows` を置き換え:

```typescript
windows: {
  update: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
},
system: {
  display: {
    getInfo: vi.fn(),
  },
},
```

`createChromeMock` 内の `runtime` に追加:

```typescript
getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
```

- [ ] **Step 4: ビルド確認**

Run: `pnpm check`
Expected: PASS (型エラーなし)

- [ ] **Step 5: コミット**

```bash
git add manifest.config.ts src/shared/types/messages.ts src/test/mocks/chrome.mock.ts
git commit -m "feat: OPEN_WORKSPACE メッセージ型と system.display permission を追加"
```

---

## Task 2: ワークスペースリソース解決 (純粋関数)

**Files:**
- Create: `src/shared/utils/workspace-resources.ts`
- Test: `src/test/shared/utils/workspace-resources.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/test/shared/utils/workspace-resources.test.ts
import { describe, expect, it } from "vitest";
import type { TreeNodeDto } from "../../domain/ports/epic-processor.port";
import { resolveWorkspaceResources } from "../../shared/utils/workspace-resources";

function createIssueNode(overrides?: {
  number?: number;
  url?: string;
  children?: readonly TreeNodeDto[];
}): TreeNodeDto {
  return {
    kind: {
      type: "issue",
      number: overrides?.number ?? 42,
      title: "Test issue",
      url: overrides?.url ?? "https://github.com/owner/repo/issues/42",
      state: "OPEN",
      labels: [],
    },
    children: overrides?.children ?? [],
    depth: 1,
  };
}

function createPrChild(url: string, number: number): TreeNodeDto {
  return {
    kind: {
      type: "pullRequest",
      number,
      title: "Test PR",
      url,
      prData: {
        additions: 10,
        deletions: 5,
        ciStatus: "Passed",
        approvalStatus: "Approved",
        mergeableStatus: "MERGEABLE",
        isDraft: false,
        sizeLabel: "S",
        unresolvedCommentCount: 0,
      },
    },
    children: [],
    depth: 2,
  };
}

function createSessionChild(url: string, issueNumber: number): TreeNodeDto {
  return {
    kind: {
      type: "session",
      title: "Investigate Issue #42",
      url,
      issueNumber,
    },
    children: [],
    depth: 2,
  };
}

describe("resolveWorkspaceResources", () => {
  it("should resolve all resources when issue has PR and session children", () => {
    const node = createIssueNode({
      children: [
        createPrChild("https://github.com/owner/repo/pull/123", 123),
        createSessionChild("https://claude.ai/code/session-1", 42),
      ],
    });

    const result = resolveWorkspaceResources(node);

    expect(result).toEqual({
      issueNumber: 42,
      issueUrl: "https://github.com/owner/repo/issues/42",
      prUrl: "https://github.com/owner/repo/pull/123",
      sessionUrl: "https://claude.ai/code/session-1",
    });
  });

  it("should return null prUrl when no PR children exist", () => {
    const node = createIssueNode({
      children: [createSessionChild("https://claude.ai/code/session-1", 42)],
    });

    const result = resolveWorkspaceResources(node);

    expect(result.prUrl).toBeNull();
    expect(result.sessionUrl).toBe("https://claude.ai/code/session-1");
  });

  it("should return null sessionUrl when no session children exist", () => {
    const node = createIssueNode({
      children: [createPrChild("https://github.com/owner/repo/pull/123", 123)],
    });

    const result = resolveWorkspaceResources(node);

    expect(result.sessionUrl).toBeNull();
    expect(result.prUrl).toBe("https://github.com/owner/repo/pull/123");
  });

  it("should return null for both when issue has no children", () => {
    const node = createIssueNode({ children: [] });

    const result = resolveWorkspaceResources(node);

    expect(result.prUrl).toBeNull();
    expect(result.sessionUrl).toBeNull();
  });

  it("should pick the first PR when multiple PR children exist", () => {
    const node = createIssueNode({
      children: [
        createPrChild("https://github.com/owner/repo/pull/100", 100),
        createPrChild("https://github.com/owner/repo/pull/200", 200),
      ],
    });

    const result = resolveWorkspaceResources(node);

    expect(result.prUrl).toBe("https://github.com/owner/repo/pull/100");
  });

  it("should pick the first session when multiple session children exist", () => {
    const node = createIssueNode({
      children: [
        createSessionChild("https://claude.ai/code/session-a", 42),
        createSessionChild("https://claude.ai/code/session-b", 42),
      ],
    });

    const result = resolveWorkspaceResources(node);

    expect(result.sessionUrl).toBe("https://claude.ai/code/session-a");
  });

  it("should ignore epic children", () => {
    const epicChild: TreeNodeDto = {
      kind: { type: "epic", number: 1, title: "Epic" },
      children: [],
      depth: 2,
    };
    const node = createIssueNode({ children: [epicChild] });

    const result = resolveWorkspaceResources(node);

    expect(result.prUrl).toBeNull();
    expect(result.sessionUrl).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行 → RED 確認**

Run: `pnpm test -- src/test/shared/utils/workspace-resources.test.ts`
Expected: FAIL — `Cannot find module '../../shared/utils/workspace-resources'`

- [ ] **Step 3: 実装**

```typescript
// src/shared/utils/workspace-resources.ts
import type { TreeNodeDto } from "../../domain/ports/epic-processor.port";

export interface WorkspaceResources {
  readonly issueNumber: number;
  readonly issueUrl: string;
  readonly prUrl: string | null;
  readonly sessionUrl: string | null;
}

/**
 * Issue ノードの子ノードから PR URL と Claude Session URL を抽出する。
 * 複数ある場合はツリー内の最初のものを選択する。
 */
export function resolveWorkspaceResources(issueNode: TreeNodeDto): WorkspaceResources {
  if (issueNode.kind.type !== "issue") {
    throw new Error(`Expected issue node, got ${issueNode.kind.type}`);
  }

  let prUrl: string | null = null;
  let sessionUrl: string | null = null;

  for (const child of issueNode.children) {
    if (prUrl === null && child.kind.type === "pullRequest") {
      prUrl = child.kind.url;
    }
    if (sessionUrl === null && child.kind.type === "session") {
      sessionUrl = child.kind.url;
    }
    if (prUrl !== null && sessionUrl !== null) break;
  }

  return {
    issueNumber: issueNode.kind.number,
    issueUrl: issueNode.kind.url,
    prUrl,
    sessionUrl,
  };
}
```

- [ ] **Step 4: テスト実行 → GREEN 確認**

Run: `pnpm test -- src/test/shared/utils/workspace-resources.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/shared/utils/workspace-resources.ts src/test/shared/utils/workspace-resources.test.ts
git commit -m "feat: Issue ノードからワークスペースリソース URL を解決する純粋関数を追加"
```

---

## Task 3: WindowManager ポート + アダプタ

**Files:**
- Create: `src/domain/ports/window-manager.port.ts`
- Create: `src/adapter/chrome/window-manager.adapter.ts`
- Test: `src/test/adapter/chrome/window-manager.adapter.test.ts`

- [ ] **Step 1: ポートインターフェースを定義**

```typescript
// src/domain/ports/window-manager.port.ts

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
   * @param queryPattern - chrome.tabs.query に渡す URL パターン (例: "https://github.com/* /* /issues/*")
   * @param matchUrl - 結果をフィルタするベース URL。tab.url が matchUrl で始まるか比較する
   */
  findTab(queryPattern: string, matchUrl: string): Promise<TabInfo | null>;

  /** 指定 URL と位置で新しいウィンドウを作成する */
  createWindow(url: string, bounds: ScreenBounds): Promise<void>;

  /** 既存ウィンドウを指定位置に移動・リサイズする */
  moveWindowToBounds(windowId: number, bounds: ScreenBounds): Promise<void>;

  /** タブを新しいウィンドウに分離し、指定位置に配置する */
  moveTabToNewWindow(tabId: number, bounds: ScreenBounds): Promise<void>;
}
```

- [ ] **Step 2: アダプタのテストを書く**

```typescript
// src/test/adapter/chrome/window-manager.adapter.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WindowManagerAdapter } from "../../../adapter/chrome/window-manager.adapter";
import { getChromeMock, resetChromeMock, setupChromeMock } from "../../mocks/chrome.mock";

describe("WindowManagerAdapter", () => {
  let adapter: WindowManagerAdapter;

  beforeEach(() => {
    setupChromeMock();
    adapter = new WindowManagerAdapter();
  });

  afterEach(() => {
    resetChromeMock();
  });

  describe("getScreenWorkArea", () => {
    it("should return workArea of the first display", async () => {
      const mock = getChromeMock();
      mock.system.display.getInfo.mockImplementation((cb: (info: unknown[]) => void) => {
        cb([{ workArea: { left: 0, top: 0, width: 1920, height: 1040 } }]);
      });

      const result = await adapter.getScreenWorkArea();

      expect(result).toEqual({ left: 0, top: 0, width: 1920, height: 1040 });
    });
  });

  describe("findTab", () => {
    it("should return TabInfo when matching tab is found in a single-tab window", async () => {
      const mock = getChromeMock();
      mock.tabs.query
        .mockResolvedValueOnce([
          { id: 10, url: "https://github.com/owner/repo/issues/42", windowId: 1 },
        ])
        .mockResolvedValueOnce([{ id: 10 }]); // windowId query for tab count

      const result = await adapter.findTab(
        "https://github.com/*/*/issues/*",
        "https://github.com/owner/repo/issues/42",
      );

      expect(result).toEqual({ tabId: 10, windowId: 1, windowTabCount: 1 });
    });

    it("should return null when no matching tab exists", async () => {
      const mock = getChromeMock();
      mock.tabs.query.mockResolvedValue([]);

      const result = await adapter.findTab(
        "https://github.com/*/*/issues/*",
        "https://github.com/owner/repo/issues/99",
      );

      expect(result).toBeNull();
    });

    it("should match tabs whose URL starts with matchUrl (fragment tolerance)", async () => {
      const mock = getChromeMock();
      mock.tabs.query
        .mockResolvedValueOnce([
          { id: 10, url: "https://github.com/owner/repo/issues/42#comment-1", windowId: 1 },
        ])
        .mockResolvedValueOnce([{ id: 10 }]);

      const result = await adapter.findTab(
        "https://github.com/*/*/issues/*",
        "https://github.com/owner/repo/issues/42",
      );

      expect(result).toEqual({ tabId: 10, windowId: 1, windowTabCount: 1 });
    });

    it("should report correct windowTabCount for multi-tab window", async () => {
      const mock = getChromeMock();
      mock.tabs.query
        .mockResolvedValueOnce([
          { id: 10, url: "https://github.com/owner/repo/issues/42", windowId: 1 },
        ])
        .mockResolvedValueOnce([{ id: 10 }, { id: 11 }, { id: 12 }]);

      const result = await adapter.findTab(
        "https://github.com/*/*/issues/*",
        "https://github.com/owner/repo/issues/42",
      );

      expect(result).toEqual({ tabId: 10, windowId: 1, windowTabCount: 3 });
    });
  });

  describe("createWindow", () => {
    it("should call chrome.windows.create with url and bounds", async () => {
      const mock = getChromeMock();
      mock.windows.create.mockResolvedValue({ id: 5 });

      await adapter.createWindow("https://github.com/owner/repo/issues/42", {
        left: 0, top: 0, width: 960, height: 1040,
      });

      expect(mock.windows.create).toHaveBeenCalledWith({
        url: "https://github.com/owner/repo/issues/42",
        left: 0, top: 0, width: 960, height: 1040,
        focused: false,
      });
    });
  });

  describe("moveWindowToBounds", () => {
    it("should call chrome.windows.update with bounds", async () => {
      const mock = getChromeMock();
      mock.windows.update.mockResolvedValue({});

      await adapter.moveWindowToBounds(1, { left: 960, top: 0, width: 960, height: 520 });

      expect(mock.windows.update).toHaveBeenCalledWith(1, {
        left: 960, top: 0, width: 960, height: 520,
        state: "normal",
      });
    });
  });

  describe("moveTabToNewWindow", () => {
    it("should call chrome.windows.create with tabId and bounds", async () => {
      const mock = getChromeMock();
      mock.windows.create.mockResolvedValue({ id: 6 });

      await adapter.moveTabToNewWindow(10, { left: 960, top: 520, width: 960, height: 520 });

      expect(mock.windows.create).toHaveBeenCalledWith({
        tabId: 10,
        left: 960, top: 520, width: 960, height: 520,
        focused: false,
      });
    });
  });
});
```

- [ ] **Step 3: テスト実行 → RED 確認**

Run: `pnpm test -- src/test/adapter/chrome/window-manager.adapter.test.ts`
Expected: FAIL — `Cannot find module '../../../adapter/chrome/window-manager.adapter'`

- [ ] **Step 4: アダプタ実装**

```typescript
// src/adapter/chrome/window-manager.adapter.ts
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
```

- [ ] **Step 5: テスト実行 → GREEN 確認**

Run: `pnpm test -- src/test/adapter/chrome/window-manager.adapter.test.ts`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add src/domain/ports/window-manager.port.ts src/adapter/chrome/window-manager.adapter.ts src/test/adapter/chrome/window-manager.adapter.test.ts
git commit -m "feat: WindowManager ポートとアダプタを追加 (chrome.windows / system.display)"
```

---

## Task 4: レイアウト計算 + ワークスペースオーケストレーション

**Files:**
- Create: `src/background/workspace-layout.usecase.ts`
- Test: `src/test/background/workspace-layout.usecase.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/test/background/workspace-layout.usecase.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenBounds, TabInfo, WindowManagerPort } from "../../domain/ports/window-manager.port";
import {
  calculateLayout,
  createWorkspaceLayoutUseCase,
} from "../../background/workspace-layout.usecase";

function createMockWindowManager(): {
  [K in keyof WindowManagerPort]: ReturnType<typeof vi.fn>;
} {
  return {
    getScreenWorkArea: vi.fn(),
    findTab: vi.fn(),
    createWindow: vi.fn(),
    moveWindowToBounds: vi.fn(),
    moveTabToNewWindow: vi.fn(),
  };
}

describe("calculateLayout", () => {
  it("should split screen into left-half, right-top, right-bottom", () => {
    const screen: ScreenBounds = { left: 0, top: 0, width: 1920, height: 1080 };
    const layout = calculateLayout(screen);

    expect(layout.claude).toEqual({ left: 0, top: 0, width: 960, height: 1080 });
    expect(layout.issue).toEqual({ left: 960, top: 0, width: 960, height: 540 });
    expect(layout.pr).toEqual({ left: 960, top: 540, width: 960, height: 540 });
  });

  it("should handle odd dimensions without rounding errors", () => {
    const screen: ScreenBounds = { left: 0, top: 0, width: 1921, height: 1081 };
    const layout = calculateLayout(screen);

    // 左半分: floor(1921/2) = 960
    expect(layout.claude.width).toBe(960);
    // 右半分: 1921 - 960 = 961
    expect(layout.issue.width).toBe(961);
    expect(layout.pr.width).toBe(961);
    // 上半分: floor(1081/2) = 540
    expect(layout.issue.height).toBe(540);
    // 下半分: 1081 - 540 = 541
    expect(layout.pr.height).toBe(541);
  });

  it("should respect screen offset (workArea with taskbar)", () => {
    const screen: ScreenBounds = { left: 0, top: 0, width: 1920, height: 1040 };
    const layout = calculateLayout(screen);

    expect(layout.claude.height).toBe(1040);
    expect(layout.issue.height).toBe(520);
    expect(layout.pr.top).toBe(520);
    expect(layout.pr.height).toBe(520);
  });
});

describe("createWorkspaceLayoutUseCase", () => {
  let wm: ReturnType<typeof createMockWindowManager>;
  const SCREEN: ScreenBounds = { left: 0, top: 0, width: 1920, height: 1080 };

  beforeEach(() => {
    wm = createMockWindowManager();
    wm.getScreenWorkArea.mockResolvedValue(SCREEN);
    wm.createWindow.mockResolvedValue(undefined);
    wm.moveWindowToBounds.mockResolvedValue(undefined);
    wm.moveTabToNewWindow.mockResolvedValue(undefined);
  });

  it("should create 3 new windows when no existing tabs found", async () => {
    wm.findTab.mockResolvedValue(null);

    const usecase = createWorkspaceLayoutUseCase(wm);
    await usecase.openWorkspace({
      issueNumber: 42,
      issueUrl: "https://github.com/owner/repo/issues/42",
      prUrl: "https://github.com/owner/repo/pull/123",
      sessionUrl: "https://claude.ai/code/session-1",
    });

    expect(wm.createWindow).toHaveBeenCalledTimes(3);
    // Claude = left half
    expect(wm.createWindow).toHaveBeenCalledWith(
      "https://claude.ai/code/session-1",
      { left: 0, top: 0, width: 960, height: 1080 },
    );
    // Issue = right top
    expect(wm.createWindow).toHaveBeenCalledWith(
      "https://github.com/owner/repo/issues/42",
      { left: 960, top: 0, width: 960, height: 540 },
    );
    // PR = right bottom
    expect(wm.createWindow).toHaveBeenCalledWith(
      "https://github.com/owner/repo/pull/123",
      { left: 960, top: 540, width: 960, height: 540 },
    );
  });

  it("should reuse existing single-tab window by moving it", async () => {
    const existingTab: TabInfo = { tabId: 10, windowId: 1, windowTabCount: 1 };
    wm.findTab
      .mockResolvedValueOnce(existingTab) // session
      .mockResolvedValueOnce(null)        // issue
      .mockResolvedValueOnce(null);       // pr

    const usecase = createWorkspaceLayoutUseCase(wm);
    await usecase.openWorkspace({
      issueNumber: 42,
      issueUrl: "https://github.com/owner/repo/issues/42",
      prUrl: "https://github.com/owner/repo/pull/123",
      sessionUrl: "https://claude.ai/code/session-1",
    });

    expect(wm.moveWindowToBounds).toHaveBeenCalledWith(1, {
      left: 0, top: 0, width: 960, height: 1080,
    });
    expect(wm.createWindow).toHaveBeenCalledTimes(2);
  });

  it("should split tab from multi-tab window into new window", async () => {
    const sharedTab: TabInfo = { tabId: 10, windowId: 1, windowTabCount: 3 };
    wm.findTab
      .mockResolvedValueOnce(null)      // session
      .mockResolvedValueOnce(sharedTab) // issue
      .mockResolvedValueOnce(null);     // pr

    const usecase = createWorkspaceLayoutUseCase(wm);
    await usecase.openWorkspace({
      issueNumber: 42,
      issueUrl: "https://github.com/owner/repo/issues/42",
      prUrl: "https://github.com/owner/repo/pull/123",
      sessionUrl: null,
    });

    expect(wm.moveTabToNewWindow).toHaveBeenCalledWith(10, {
      left: 960, top: 0, width: 960, height: 540,
    });
  });

  it("should use placeholder URL when sessionUrl is null", async () => {
    wm.findTab.mockResolvedValue(null);

    const usecase = createWorkspaceLayoutUseCase(wm);
    await usecase.openWorkspace({
      issueNumber: 42,
      issueUrl: "https://github.com/owner/repo/issues/42",
      prUrl: "https://github.com/owner/repo/pull/123",
      sessionUrl: null,
    });

    const claudeCall = wm.createWindow.mock.calls.find(
      (call: [string, ScreenBounds]) => call[1].left === 0 && call[1].width === 960,
    );
    expect(claudeCall).toBeDefined();
    expect(claudeCall![0]).toContain("placeholder.html");
    expect(claudeCall![0]).toContain("type=session");
    expect(claudeCall![0]).toContain("issue=42");
  });

  it("should use placeholder URL when prUrl is null", async () => {
    wm.findTab.mockResolvedValue(null);

    const usecase = createWorkspaceLayoutUseCase(wm);
    await usecase.openWorkspace({
      issueNumber: 42,
      issueUrl: "https://github.com/owner/repo/issues/42",
      prUrl: null,
      sessionUrl: "https://claude.ai/code/session-1",
    });

    const prCall = wm.createWindow.mock.calls.find(
      (call: [string, ScreenBounds]) => call[1].top === 540,
    );
    expect(prCall).toBeDefined();
    expect(prCall![0]).toContain("placeholder.html");
    expect(prCall![0]).toContain("type=pr");
    expect(prCall![0]).toContain("issue=42");
  });
});
```

- [ ] **Step 2: テスト実行 → RED 確認**

Run: `pnpm test -- src/test/background/workspace-layout.usecase.test.ts`
Expected: FAIL — `Cannot find module '../../background/workspace-layout.usecase'`

- [ ] **Step 3: 実装**

```typescript
// src/background/workspace-layout.usecase.ts
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
      const claudePattern = request.sessionUrl ? "*://claude.ai/code/*" : `chrome-extension://${chrome.runtime.id}/*`;

      const issuePattern = "https://github.com/*/*/issues/*";

      const prUrl = request.prUrl ?? placeholderUrl("pr", request.issueNumber);
      const prPattern = request.prUrl ? "https://github.com/*/*/pull/*" : `chrome-extension://${chrome.runtime.id}/*`;

      await openOrReuseWindow(claudeUrl, claudePattern, layout.claude, windowManager);
      await openOrReuseWindow(request.issueUrl, issuePattern, layout.issue, windowManager);
      await openOrReuseWindow(prUrl, prPattern, layout.pr, windowManager);
    },
  };
}
```

- [ ] **Step 4: テスト実行 → GREEN 確認**

Run: `pnpm test -- src/test/background/workspace-layout.usecase.test.ts`
Expected: ALL PASS

NOTE: テスト内で `chrome.runtime.getURL` と `chrome.runtime.id` が呼ばれる。Task 1 Step 3 でモックに追加済み。

- [ ] **Step 5: コミット**

```bash
git add src/background/workspace-layout.usecase.ts src/test/background/workspace-layout.usecase.test.ts src/test/mocks/chrome.mock.ts
git commit -m "feat: ワークスペースレイアウト計算と配置オーケストレーションを追加"
```

---

## Task 5: プレースホルダーページ

**Files:**
- Create: `public/placeholder.html`

- [ ] **Step 1: プレースホルダー HTML を作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR Sidebar — Placeholder</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .container { text-align: center; }
    .icon { font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.6; }
    .message { font-size: 1.25rem; color: #8b949e; line-height: 1.6; }
    .issue-number { color: #58a6ff; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon" id="icon"></div>
    <div class="message" id="message"></div>
  </div>
  <script>
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const issueNum = Number(params.get("issue"));
    const icon = document.getElementById("icon");
    const message = document.getElementById("message");

    if (icon && message && !Number.isNaN(issueNum)) {
      if (type === "pr") {
        icon.textContent = "\uD83D\uDD00";
        message.textContent = "PR \u306F\u307E\u3060\u4F5C\u6210\u3055\u308C\u3066\u3044\u307E\u305B\u3093 \u2014 Issue #" + issueNum;
      } else if (type === "session") {
        icon.textContent = "\uD83E\uDD16";
        message.textContent = "Claude Code Web \u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093 \u2014 Issue #" + issueNum;
      }
    }
  </script>
</body>
</html>
```

NOTE: Unicode エスケープを使い `innerHTML` を使わずに `textContent` で組み立てる。XSS 対策として issue パラメータは `Number()` で数値変換済み。

- [ ] **Step 2: ビルド確認**

Run: `pnpm build`
Expected: `dist/placeholder.html` が出力に含まれる

- [ ] **Step 3: コミット**

```bash
git add public/placeholder.html
git commit -m "feat: ワークスペースのプレースホルダーページを追加"
```

---

## Task 6: メッセージハンドラー + Bootstrap 結合

**Files:**
- Modify: `src/background/types.ts`
- Modify: `src/background/message-handler.ts`
- Modify: `src/background/bootstrap.ts`
- Test: `src/test/background/message-handler.test.ts` (追記)

- [ ] **Step 1: テストを書く (message-handler.test.ts に追記)**

ファイル末尾 (最後の `});` の直前) に以下を追加:

```typescript
describe("OPEN_WORKSPACE", () => {
  it("should call workspaceLayout.openWorkspace with payload and respond with success", async () => {
    const mockOpenWorkspace = vi.fn().mockResolvedValue(undefined);
    const servicesWithWorkspace = {
      ...services,
      workspaceLayout: { openWorkspace: mockOpenWorkspace },
    } as unknown as AppServices;
    const wsHandler = createMessageHandler(servicesWithWorkspace);

    const sendResponse = vi.fn();
    wsHandler(
      {
        type: "OPEN_WORKSPACE",
        payload: {
          issueNumber: 42,
          issueUrl: "https://github.com/owner/repo/issues/42",
          prUrl: "https://github.com/owner/repo/pull/123",
          sessionUrl: null,
        },
      },
      createTrustedSender(),
      sendResponse,
    );

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(mockOpenWorkspace).toHaveBeenCalledWith({
      issueNumber: 42,
      issueUrl: "https://github.com/owner/repo/issues/42",
      prUrl: "https://github.com/owner/repo/pull/123",
      sessionUrl: null,
    });
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined });
  });
});
```

- [ ] **Step 2: テスト実行 → RED 確認**

Run: `pnpm test -- src/test/background/message-handler.test.ts`
Expected: FAIL — `OPEN_WORKSPACE` handler が未実装

- [ ] **Step 3: `src/background/types.ts` に `workspaceLayout` を追加**

import 追加:

```typescript
import type { WorkspaceOpenRequest } from "./workspace-layout.usecase";
```

`AppServices` に追加:

```typescript
readonly workspaceLayout: {
  readonly openWorkspace: (request: WorkspaceOpenRequest) => Promise<void>;
};
```

- [ ] **Step 4: `src/background/message-handler.ts` にハンドラー追加**

`ERROR_MESSAGES` に追加:

```typescript
OPEN_WORKSPACE: "Failed to open workspace",
```

`createMessageHandler` の `services` Pick 型に追加:

```typescript
| "workspaceLayout"
```

`handleMessage` の `services` Pick 型にも同様に追加。

`switch` 文の `GET_CLAUDE_SESSIONS` case の後、`default` case の前に追加:

```typescript
case "OPEN_WORKSPACE": {
  const msg = message as RequestMessage<"OPEN_WORKSPACE">;
  await services.workspaceLayout.openWorkspace(msg.payload);
  sendResponse({ ok: true, data: undefined });
  break;
}
```

- [ ] **Step 5: `src/background/bootstrap.ts` で結合**

import 追加:

```typescript
import { WindowManagerAdapter } from "../adapter/chrome/window-manager.adapter";
import { createWorkspaceLayoutUseCase } from "./workspace-layout.usecase";
```

`initializeApp` 内、`const claudeSessionWatcher = ...` の後に追加:

```typescript
const windowManager = new WindowManagerAdapter();
const workspaceLayout = createWorkspaceLayoutUseCase(windowManager);
```

`createMessageHandler` の引数オブジェクトに追加:

```typescript
workspaceLayout,
```

`services` オブジェクトに追加:

```typescript
workspaceLayout,
```

- [ ] **Step 6: テスト実行 → GREEN 確認**

Run: `pnpm test -- src/test/background/message-handler.test.ts`
Expected: ALL PASS

- [ ] **Step 7: 型チェック**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add src/background/types.ts src/background/message-handler.ts src/background/bootstrap.ts src/test/background/message-handler.test.ts
git commit -m "feat: OPEN_WORKSPACE メッセージハンドラーと Bootstrap 結合を追加"
```

---

## Task 7: UI — TreeNode ⧉ ボタン + プロップチェーン

**Files:**
- Modify: `src/sidepanel/components/TreeNode.svelte`
- Modify: `src/sidepanel/components/EpicSection.svelte`
- Modify: `src/sidepanel/components/MainScreen.svelte`
- Modify: `src/sidepanel/main.ts`

- [ ] **Step 1: `src/sidepanel/main.ts` に `onOpenWorkspace` コールバックを追加**

import 追加:

```typescript
import type { WorkspaceResources } from "../shared/utils/workspace-resources";
```

`mount` の `props` に追加:

```typescript
onOpenWorkspace: async (resources: WorkspaceResources) => {
  const response = await chromeSendMessage("OPEN_WORKSPACE", {
    issueNumber: resources.issueNumber,
    issueUrl: resources.issueUrl,
    prUrl: resources.prUrl,
    sessionUrl: resources.sessionUrl,
  });
  if (!response.ok) {
    console.error("Failed to open workspace:", response.error.message);
  }
},
```

NOTE: `App.svelte` → `MainScreen.svelte` へのプロップ中継も必要。`App.svelte` の Props 型と中継を更新する。

- [ ] **Step 2: `App.svelte` に `onOpenWorkspace` prop を追加**

`App.svelte` の Props 型に追加して `MainScreen` に中継する。既存の `onNavigate` と同じパターンで中継する。

- [ ] **Step 3: `MainScreen.svelte` の Props に `onOpenWorkspace` を追加**

Props 型に追加:

```typescript
onOpenWorkspace?: (resources: WorkspaceResources) => void;
```

import 追加:

```typescript
import type { WorkspaceResources } from "../../shared/utils/workspace-resources";
```

`EpicSection` コンポーネントへの属性に追加:

```svelte
<EpicSection tree={epicData} {activeTabUrl} {onNavigate} {onOpenWorkspace} />
```

- [ ] **Step 4: `EpicSection.svelte` の Props に `onOpenWorkspace` を追加**

import 追加:

```typescript
import type { WorkspaceResources } from "../../shared/utils/workspace-resources";
```

Props 型に追加:

```typescript
onOpenWorkspace?: (resources: WorkspaceResources) => void;
```

`TreeNode` への属性に追加:

```svelte
<TreeNode node={root} {activeTabUrl} {onNavigate} {onOpenWorkspace} />
```

- [ ] **Step 5: `TreeNode.svelte` に ⧉ ボタンを追加**

import 追加:

```typescript
import type { WorkspaceResources } from "../../shared/utils/workspace-resources";
import { resolveWorkspaceResources } from "../../shared/utils/workspace-resources";
```

Props 型に追加:

```typescript
onOpenWorkspace?: (resources: WorkspaceResources) => void;
```

$props に追加:

```typescript
const { node, activeTabUrl, onNavigate, onOpenWorkspace }: Props = $props();
```

ホバー状態の管理:

```typescript
let hovered = $state(false);
```

Issue ノードのクリックハンドラー追加:

```typescript
function handleOpenWorkspace(event: MouseEvent): void {
  event.stopPropagation();
  event.preventDefault();
  if (node.kind.type !== "issue" || !onOpenWorkspace) return;
  const resources = resolveWorkspaceResources(node);
  onOpenWorkspace(resources);
}
```

Issue ブロック (`:else if node.kind.type === "issue"`) の `<div class="node-content">` を以下に変更:

```svelte
<div
  class="node-content"
  onclick={(e) => handleNavigate(e, node.kind.type === "issue" ? node.kind.url : "")}
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
>
  {#if isDeepNested}<span class="deep-indicator">&#8627;</span>{/if}
  {#if hasChildren}
    <button class="inline-toggle" onclick={(e) => { e.stopPropagation(); toggle(); }}>
      <span class="toggle-icon">{open ? "&#9660;" : "&#9654;"}</span>
    </button>
  {/if}
  <span class="node-icon">&#128203;</span>
  <a class="node-title clickable" href={safeUrl(node.kind.url)} target="_blank" rel="noopener noreferrer">
    {node.kind.title}
  </a>
  <span class="node-number">#{node.kind.number}</span>
  {#if node.kind.state === "CLOSED"}
    <span class="state-badge closed">Closed</span>
  {/if}
  {#if hovered && onOpenWorkspace}
    <button
      class="workspace-btn"
      title="ワークスペースを開く"
      onclick={handleOpenWorkspace}
    >&#10697;</button>
  {/if}
  {#if node.kind.labels.length > 0}
    <div class="labels">
      {#each node.kind.labels as label (label.name)}
        <span class="label-badge" style="background-color: #{label.color};">{label.name}</span>
      {/each}
    </div>
  {/if}
</div>
```

再帰呼び出しにも `onOpenWorkspace` を渡す:

```svelte
<TreeNode node={child} {activeTabUrl} {onNavigate} {onOpenWorkspace} />
```

CSS 追加 (`<style>` ブロック内):

```css
.workspace-btn {
  background: #30363d;
  border: 1px solid #484f58;
  border-radius: 4px;
  padding: 0.0625rem 0.375rem;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.75rem;
  flex-shrink: 0;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
}

.workspace-btn:hover {
  background: #484f58;
  color: #e6edf3;
}
```

- [ ] **Step 6: 型チェック**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 7: 全テスト実行**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 8: コミット**

```bash
git add src/sidepanel/components/TreeNode.svelte src/sidepanel/components/EpicSection.svelte src/sidepanel/components/MainScreen.svelte src/sidepanel/main.ts src/sidepanel/App.svelte
git commit -m "feat: Issue ノードにワークスペース ⧉ ボタンを追加 (ホバー表示)"
```

---

## Final Verification

- [ ] **Step 1: 全テスト実行**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: ビルド確認**

Run: `pnpm build`
Expected: ビルド成功、`dist/placeholder.html` が含まれる

- [ ] **Step 3: 型チェック**

Run: `pnpm check`
Expected: エラーなし
