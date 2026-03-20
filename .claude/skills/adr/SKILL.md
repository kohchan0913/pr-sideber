---
name: adr
description: 設計判断をADRテンプレートでdocs/adr/に記録する。「なんでこの技術にしたの？」「設計判断を残したい」「ADR書いて」「技術選定の記録」「アーキテクチャ決定」「なぜこうしたか記録」などの依頼時に使用する。
---

# ADR 作成

$ARGUMENTS の設計判断を記録する。

## 手順

1. `docs/adr/` の既存 ADR を確認し次の番号を採番
2. テンプレートに従って ADR を作成
3. `docs/adr/README.md` のインデックスを更新

## テンプレート

```markdown
# ADR-XXX: タイトル

**Status**: Accepted | Rejected | Deprecated | Superseded
**Date**: YYYY-MM-DD

## Context
なぜこの判断が必要になったか。

## Decision
何を選択したか。

## Consequences
ポジティブ / ネガティブな影響。

## Alternatives Considered
1. **代替案A** — 却下理由
```
