雛形
```
# ID:
- PBI名: 
- ステータス: [to do/in progress/done]
- ユーザストーリー
- 受け入れ基準
- 注意事項
- 指摘事項（in progressの場合のみ）
```
# ID: 1
- PBI名: ロガーの改善
- ステータス: done
- 内容
  - システム内部で簡単に認証済みユーザやリクエストIDを含むロガーを取得して利用できるようにする
    - なぜなら、現状はbaseActionのコンテキストに含めているが、これではロガーをアプリケーション層やドメイン層まで引数等で伝播させなければならず、将来的な実装負荷増につながるからだ
- 受け入れ基準
  - ユーザが認証済みの場合は認証済みユーザやリクエストIDを含むロガーを返し、そうでない場合は通常のロガーを返す関数を`next-server/lib/server/logger.ts`に定義して、全てのレイヤーでこれを呼び出すようにする
- 実装内容
  - `next-server/lib/server/requestContext.ts`: AsyncLocalStorageを使用したリクエストコンテキスト管理
  - `next-server/lib/server/logger.ts`: `getLogger()`関数を追加。コンテキスト内ではrequestId/employeeIdを含むロガーを返す
  - `next-server/lib/server/baseAction.ts`: `authenticatedAction`と`publicAction`で`runWithRequestContext`を使用
  - テストファイル: `requestContext.test.ts`、`getLogger.test.ts`
  