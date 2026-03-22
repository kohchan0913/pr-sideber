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
- IMPORTANT: 以下の全セクションが具体的な内容で埋まっていること。placeholder や空欄のまま PR を作成しない
  - `## 概要`: 1〜2文の変更説明
  - `## 変更内容`: ファイル名付きの変更リスト
  - `## 関連 Issue`: `closes #XX` でリンク (番号必須)
  - `## テスト`: 5項目チェックリスト (実行した項目のみ `[x]`)
  - `## レビュー観点`: レビュアーへの具体的な指示
- `/verify` の検証ループ結果を含める

## リレーション
- IMPORTANT: リレーションは本文に書かない。GitHub API でシステム的に管理する
- サブ issue: `gh api repos/{owner}/{repo}/issues/$PARENT/sub_issues -f sub_issue_id=CHILD_ID`
- 詳細な手順は `/issue` スキルに従う
