---
paths:
  - "src/**/*.ts"
  - "src/**/*.svelte"
  - "rust-core/**/*.rs"
---

# コーディング規約

## 不変性 (IMPORTANT)

データは直接変更しない。新しいオブジェクトを作る。

```typescript
// GOOD
const updated = { ...pr, isApproved: true };
const newList = [...prList, newPR];

// BAD
pr.isApproved = true;
prList.push(newPR);
```

Rust: 不変バインディングをデフォルトにする。`mut` は必要な場合のみ。

## 命名規則

### TypeScript / Svelte
- 変数・関数: camelCase (`prList`, `fetchPullRequests`)
- 定数: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_TIMEOUT_MS`)
- 型・インターフェース: PascalCase (`PullRequest`, `ReviewDecision`)
- コンポーネント: PascalCase (`PRList.svelte`, `ApprovalBadge.svelte`)
- イベントハンドラ: `on` + 動詞 (`onRefresh`, `onOpenPR`)

### Rust
- 関数・変数: snake_case (`filter_by_approval`)
- 構造体・列挙型: PascalCase (`PullRequest`, `ApprovalStatus`)
- 定数: UPPER_SNAKE_CASE (`MAX_PAGE_SIZE`)

## 構造
- 関数は 50 行以内
- ネストは 3 段以内。早期 return で浅くする
- マジックナンバー禁止。名前付き定数を使う
- コメントは「なぜ」を書く。「何を」はコードで表現する
