# ワークスペース自動配置 — 設計ドキュメント

## 概要

PR Sidebar の Epic ツリーで Issue ノードにホバーすると表示される「⧉」ボタンをクリックすると、その Issue に紐づく3リソース（Claude Code Web / Issue / PR）を3つの Chrome ウィンドウとして画面に自動配置する。

## スコープ（Phase 1）

### やること

- `chrome.system.display` でスクリーンサイズを取得
- Issue 番号から関連リソース（PR URL / Claude Session URL）を解決
- 既存タブを検索し、あればそのウィンドウを移動・リサイズ、なければ新規作成
- リソースが存在しない場合はプレースホルダーページを表示
- Issue ノードにホバー表示の ⧉ ボタンを追加

### やらないこと（別 Issue 化済み）

- ワークスペース状態の永続化と復元 → [#3](https://github.com/miyashitaAdacotech/pr-sideber/issues/3)
- リソースクリックでワークスペース自動展開 → [#4](https://github.com/miyashitaAdacotech/pr-sideber/issues/4)
- マルチモニタ対応 → [#5](https://github.com/miyashitaAdacotech/pr-sideber/issues/5)

## アーキテクチャ

### 責務分担

既存ルールに準拠。Rust/WASM には一切手を入れない。

- **Svelte**: ⧉ ボタンの表示のみ
- **TypeScript**: Chrome API 操作、メッセージング、配置ロジック
- **既存資産（変更なし）**: ClaudeSessionWatcher, EpicTree (WASM), findExistingPrTab パターン

### 新規ファイル

| ファイル | 層 | 責務 |
|---------|-----|------|
| `src/background/workspace-layout.usecase.ts` | usecase | リソース解決 + 配置オーケストレーション |
| `src/background/window-manager.ts` | adapter | `chrome.windows` / `chrome.system.display` 操作 |
| `src/sidepanel/components/placeholder.html` | UI | リソース未存在時のプレースホルダーページ |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/sidepanel/components/TreeNode.svelte` | ホバー時 ⧉ ボタン追加 |
| `src/shared/types/messages.ts` | `OPEN_WORKSPACE` メッセージ型追加 |
| `src/background/message-handler.ts` | `OPEN_WORKSPACE` ハンドラー追加 |
| `manifest.config.ts` | `system.display` permission 追加 |

### メッセージフロー

```
TreeNode.svelte (⧉ クリック)
  │
  │  chrome.runtime.sendMessage({ type: "OPEN_WORKSPACE", issueNumber })
  ▼
message-handler.ts
  │
  │  case "OPEN_WORKSPACE":
  ▼
workspace-layout.usecase.ts
  │
  ├─ resolveWorkspaceResources(issueNumber)
  │   ├─ Issue URL: ツリーノードの url フィールドをそのまま使用
  │   ├─ PR URL: ツリー内の子ノード (kind.type === "pr") の url フィールドを使用
  │   └─ Session URL: ClaudeSessionWatcher.getSessions()[issueNumber]
  │
  ├─ findOrCreateWindows(resources)
  │   ├─ 各 URL に対して既存タブを検索
  │   ├─ 見つかった → そのタブのウィンドウを使用
  │   └─ 見つからない → 新規ウィンドウ作成
  │
  └─ arrangeWindows(windowIds, screenInfo)
      └─ chrome.windows.update で位置・サイズを設定
```

## ウィンドウ配置ロジック

### レイアウト

```
┌──────────────────┬──────────────────┐
│                  │   Issue #42      │
│  Claude Code Web │   (右上)          │
│  (左半分)         ├──────────────────┤
│                  │   PR #123        │
│                  │   (右下)          │
└──────────────────┴──────────────────┘
```

### 配置計算

`chrome.system.display.getInfo()` で `workArea`（タスクバー除外の利用可能領域）を取得する。`bounds` ではなく `workArea` を使うことで、タスクバーとの重なりを防ぐ。

```typescript
// screen = chrome.system.display.getInfo()[0].workArea
const layout = {
  claude: {
    left: screen.left,
    top: screen.top,
    width: Math.floor(screen.width / 2),
    height: screen.height,
  },
  issue: {
    left: screen.left + Math.floor(screen.width / 2),
    top: screen.top,
    width: screen.width - Math.floor(screen.width / 2),
    height: Math.floor(screen.height / 2),
  },
  pr: {
    left: screen.left + Math.floor(screen.width / 2),
    top: screen.top + Math.floor(screen.height / 2),
    width: screen.width - Math.floor(screen.width / 2),
    height: screen.height - Math.floor(screen.height / 2),
  },
};
```

Phase 1 ではプライマリモニタ（`getInfo()[0]`）のみ対応。マルチモニタ対応は #5 で行う。

## リソース解決

### Issue URL

Epic ツリーのノードが持つ `url` フィールドをそのまま使用する。Issue はワークスペースのトリガーなので常に存在する。

### PR URL

Epic ツリー内で対象 Issue の子ノードから `kind.type === "pr"` を探索し、ノードの `url` フィールドを使用する。

- **0件**: `null`（プレースホルダー表示）
- **1件**: その PR の URL を使用
- **複数件**: `updatedAt` が最新の PR を選択

### Claude Session URL

`ClaudeSessionWatcher.getSessions()` から Issue 番号で引く。

- **0件**: `null`（プレースホルダー表示）
- **1件以上**: `isLive === true` のセッションを優先し、その中で `detectedAt` が最新のものを選択

## エッジケース

### リソース欠損時の動作

常に3ウィンドウを配置する。リソースが存在しない枠にはプレースホルダーを表示する。

| 状況 | 左（Claude） | 右上（Issue） | 右下（PR） |
|------|-------------|--------------|-----------|
| 全部あり | Session URL | Issue URL | PR URL |
| PR なし | Session URL | Issue URL | プレースホルダー |
| Session なし | プレースホルダー | Issue URL | PR URL |
| 両方なし | プレースホルダー | Issue URL | プレースホルダー |

常に3ウィンドウにする理由:
- リソースの有無でウィンドウ数が変わると配置計算が複雑化する
- プレースホルダーで枠を確保しておけば、後から実リソースが作られたときにリロードするだけで済む

### プレースホルダーページ

拡張内にバンドルした HTML ページ（`chrome-extension://xxx/placeholder.html`）を使用する。

- URL パラメータ: `?type=pr&issue=42` または `?type=session&issue=42`
- 表示内容: 「PR はまだ作成されていません — Issue #42」等
- スタイル: GitHub ダークテーマに合わせた配色

### 既存タブの扱い

既存の `findExistingPrTab` パターンを拡張し、3リソース全てに対して既存タブを検索する。

- **Issue タブ**: `https://github.com/{owner}/{repo}/issues/{number}` にマッチするタブを検索
- **PR タブ**: `https://github.com/{owner}/{repo}/pull/{number}` にマッチするタブを検索（既存の `extractPrBaseUrl` を流用）
- **Claude セッション タブ**: `sessionUrl` に完全一致するタブを検索

既存タブが見つかった場合:
1. そのタブが属するウィンドウのタブ数を確認
2. **単独タブの場合**: そのウィンドウをそのまま `chrome.windows.update` で移動・リサイズ
3. **他のタブと同居している場合**: `chrome.windows.create({ tabId })` で対象タブを新しいウィンドウに分離してから配置（元ウィンドウの他のタブを巻き込まない）

## UI デザイン

### ⧉ ボタン（ホバー表示）

TreeNode.svelte の Issue ノードにホバーしたときのみ ⧉ ボタンを表示する。

- 表示条件: `node.kind.type === "issue"` のノードのみ
- 表示タイミング: マウスホバー時
- スタイル: `background: #30363d`, `border: 1px solid #484f58`, `border-radius: 4px`, `padding: 2px 6px`
- ツールチップ: 「ワークスペースを開く」
- クリック時: `chrome.runtime.sendMessage({ type: "OPEN_WORKSPACE", issueNumber })` を送信
- クリックイベントは Issue ノード自体のクリック（ナビゲーション）と分離する（`stopPropagation`）

## Permission 追加

`manifest.config.ts` の `permissions` 配列に `"system.display"` を追加する。

```diff
- permissions: ["sidePanel", "storage", "alarms", "tabs"],
+ permissions: ["sidePanel", "storage", "alarms", "tabs", "system.display"],
```

`system.display` はスクリーンの解像度・workArea の取得に必要。ユーザーへの権限プロンプトは表示されない（低リスク権限）。
