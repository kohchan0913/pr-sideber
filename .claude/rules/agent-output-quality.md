---
paths:
  - "src/**"
  - "rust-core/**"
---

# Agent 成果物の品質ルール

IMPORTANT: 以下の3つのアンチパターンを絶対に許容しない。

## 1. サイレントフォールバックの禁止

エラーを握りつぶして「動いている風」にする行為を禁止する。

```typescript
// BAD: エラーを飲み込む
try { riskyOperation(); } catch { /* 何もしない */ }

// BAD: デフォルト値でエラーを隠す
const data = response?.data ?? [];  // API エラーなのに空配列を返す

// GOOD: エラーを明示的に処理する
try {
  riskyOperation();
} catch (error) {
  console.error('riskyOperation failed:', error);
  throw new OperationError('操作に失敗しました', { cause: error });
}
```

NOTE: grep の exit 1 対策としての `|| echo "OK"` はエラー握りつぶしではない。意図的なフォールバックにはコメントで理由を明記する。

## 2. 局所的な最適化による全体設計の棄損

計画にない設計変更が必要になったら、実装を停止して報告する。

## 3. 文脈のないコメントの禁止

```typescript
// BAD: 新仕様ではこうする / リファクタ済み / 一旦これで
// GOOD: GraphQL API v4 では reviewDecision が null の場合がある (レビュー未依頼時)
```
