# フォルダ構成
※注意
- 以下のフォルダツリーにおいて、`app/example`、`domain/user`、`application/user`はあくまでも例です。
例を参考に、実際に必要なフォルダやファイルを作成してください。

next-server/
  app/
    page.tsx
    loading.tsx
    layout.tsx
    /example # 
      page.tsx
      loading.tsx
      error.tsx
      components/ # 機能独自コンポーネント（共通化して使いまわせる場合は`next-server/components`に配置）
      hooks/ # 機能独自フック（共通化して使いまわせる場合は`next-server/hooks`に配置）
      actions/ # `lib/server/baseAction.ts`に定義した基底クラスを利用する
    (admin)/ # 管理者ページ
  components/ # 共通コンポーネント
    ui/ # 汎用的なUIコンポーネント（shadcn/uiのコンポーネントもここに含まれる）
    layout/ # 汎用的なレイアウトコンポーネント
  hooks/ # 共通フック
  types/ # 汎用型定義
    shared/
    client/
    server/
      message.ts # ユーザメッセージコード
      error.ts # エラー関連型
  store/ # zustandで管理するstate定義
  message/ja/template.ts # ユーザメッセージテンプレート
  domain/ # ドメイン層
    example/
      index.ts # エントリーポイント
      Example.ts # ユーザエンティティ
      ExampleId.ts # 値オブジェクト
      spec/ # ビジネスルール
  application/ # アプリケーション層
    shared/ # 全ユースケース共通して利用するフォルダ
      spec/ # ビジネスルール
      port/
        repository/ # DBレポジトリIF
        push/ イベントpushブローカーIF
    user/
      index.ts # エントリーポイント
      CreateUserService.ts # アプリケーションサービス
      spec/ # ビジネスルール
    mastra/ # mastra関連コード
      index.ts # エントリーポイント（Mastraオブジェクト作成）
      agents/ # エージェント定義
      tools/ # ツール定義
      workflows/ # ワークフロー定義
  infrastructure/ # インフラ層
    adapter/ # 外部接続アダプタ
      push/ # イベントpushブローカー実装
      db/
        index.ts # エントリーポイント
        drizzle/
          index.ts # エントリーポイント
          repository/ DBレポジトリ(Drizzle使用)実装
  lib/ # 汎用ロジック/全レイヤー共通ロジック
    client/
      ISseClient.ts # sseクライアントのIF
    server/
      baseAction.ts # next-safe-actionの基底クラス（エラーハンドリングや認証済みユーザの取得を一元管理）
      error.ts # アプリエラー定義
      logger.ts # ロガー定義
  drizzle/ # drizzleのDBスキーマ定義やマイグレーションsqlファイルを格納
    schema.ts # DBスキーマ
