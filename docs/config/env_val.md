# 環境変数設計

本アプリは環境変数で様々な挙動の制御が可能

| カテゴリ     | 変数名           | 必須 | 既定値 | 主な制御内容                                                              | 参照箇所                                      |
| ------------ | ---------------- | ---- | ------ | ------------------------------------------------------------------------- | --------------------------------------------- |
| データベース | DATABASE_URL     | Yes  | -      | PostgreSQL 接続文字列                                                     | drizzle.config.ts, infrastructure/adapter/db/ |
| AI API       | AI_API_KEY       | Yes  | -      | AI API の認証キー                                                         | application/mastra/                           |
| AI API       | AI_API_URL       | Yes  | -      | AI API のエンドポイント URL                                               | application/mastra/                           |
| AI API       | AI_API_MODEL     | Yes  | -      | 使用する AI モデル名                                                      | application/mastra/                           |
| 認証         | NEXTAUTH_SECRET  | Yes  | -      | JWT の署名に使用するシークレット。32 文字以上のランダム文字列を推奨       | auth.ts                                       |
| 認証         | NEXTAUTH_URL     | Yes  | -      | アプリケーションのベース URL（例: http://localhost:3000）                 | auth.ts                                       |
| 認証         | KEYCLOAK_ID      | Yes  | -      | Keycloak のクライアント ID                                                | auth.ts                                       |
| 認証         | KEYCLOAK_SECRET  | Yes  | -      | Keycloak のクライアントシークレット                                       | auth.ts                                       |
| 認証         | KEYCLOAK_ISSUER  | Yes  | -      | Keycloak の Issuer URL（例: https://keycloak.example.com/realms/myrealm） | auth.ts                                       |
| 認証         | GITLAB_CLIENT_ID | 条件付き | - | GitLab OAuth のクライアント ID（GitLab 認証を使用する場合は必須） | auth.ts |
| 認証         | GITLAB_CLIENT_SECRET | 条件付き | - | GitLab OAuth のクライアントシークレット（GitLab 認証を使用する場合は必須） | auth.ts |
| 認証         | GITLAB_BASE_URL | 条件付き | - | セルフホスト型 GitLab のベース URL（例: https://gitlab.example.com）（GitLab 認証を使用する場合は必須） | auth.ts |
| ログ         | AIKATA_LOG_DEBUG | No   | -      | 設定されている場合、ログレベルを debug に強制設定                         | lib/server/logger.ts                          |
| セキュリティ | ENCRYPTION_KEY   | Yes  | -      | APIキー、独自認証パスワード等の暗号化に使用するAES-256キー（64桁の16進数文字列）              | lib/server/encryption.ts, infrastructure/adapter/service/PasswordService.ts |
| ファイルアップロード | FILE_UPLOAD_MAX_FILE_SIZE_MB | No | 50 | ファイルアップロード時のサイズ上限（MB）。チェックリストインポート、AIチェックリスト生成で共通利用 | lib/server/fileUploadConfig.ts |
| キャッシュ | REVIEW_CACHE_DIR | No | ./review_cache | レビュードキュメントキャッシュの保存先ディレクトリ。リトライ時にドキュメントの再処理を省略するために使用 | lib/server/reviewCacheHelper.ts |
| AIタスクキュー | AI_QUEUE_CONCURRENCY | No | 1 | APIキー毎のAIタスク並列実行数。流量制限を考慮して設定 | application/aiTask/AiTaskWorkerPool.ts |
| AIタスクキュー | AI_QUEUE_POLLING_INTERVAL_MS | No | 10000 | ワーカーのキューポーリング間隔（ミリ秒） | application/aiTask/AiTaskWorker.ts |
| AIタスクキュー | QUEUE_FILE_DIR | No | ./queue_files | キュー用ファイル保存ディレクトリ。アップロードされたレビュー対象ファイルの実体を保存 | lib/server/taskFileHelper.ts |
