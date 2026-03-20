---
paths:
  - ".github/**"
---

# GitHub テンプレート準拠ルール

IMPORTANT: Issue と PR は必ずテンプレートに準拠して作成する。

## Issue
- Feature Request → `.github/ISSUE_TEMPLATE/feature.yml` に準拠
- Bug Report → `.github/ISSUE_TEMPLATE/bug.yml` に準拠
- Task → `.github/ISSUE_TEMPLATE/task.yml` に準拠
- テンプレートの必須フィールドは必ず埋める
- 受け入れ条件はチェックリスト形式で書く

## PR
- `.github/pull_request_template.md` に準拠
- 関連 Issue を `closes #XX` でリンクする
- テストチェックリストを埋める
- `/verify` の検証ループ結果を含める

## リレーション
- IMPORTANT: リレーションは本文に書かない。GitHub API でシステム的に管理する
- サブ issue: `gh api repos/{owner}/{repo}/issues/$PARENT/sub_issues -f sub_issue_id=CHILD_ID`
- 詳細な手順は `/issue` スキルに従う
