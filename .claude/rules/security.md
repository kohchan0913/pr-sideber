# セキュリティルール

IMPORTANT: これらのルールは常に適用される。例外は認めない。

## シークレット管理
- OAuth client_secret、access_token をソースコードにハードコードしない
- `.env` ファイルは `.gitignore` に含める
- `chrome.storage.local` に保存する token は最小スコープで取得する

## OAuth
- PKCE フローを使用する (OAuth App でも可能な限り)
- state パラメータで CSRF を防ぐ
- redirect_uri は厳密に固定する

## API 通信
- GitHub API 呼び出しは HTTPS のみ
- token をURLパラメータに含めない。Authorization ヘッダーを使う
- レスポンスの検証を行う

## WASM
- Rust/WASM にシークレットを埋め込まない
- WASM モジュールにネットワークアクセスさせない（API 呼び出しは TS 側の責務）
