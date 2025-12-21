# 全体方針
- 採用アーキテクチャ: クリーンアーキテクチャ
- 採用技術
  - Next.js
  - React
  - TypeScript
  - Zod
  - Drizzle
    - PostgreSQL
  - NextAuth(v4)
  - Mastra
  - Tailwind CSS
  - shadcn/ui

# 全体設計
一般的なクリーンアーキテクチャに従う
用語集(`docs/domain`)と整合するよう注意すること
以下は特筆事項
- Domain層
  - ビジネスルール
    - 命名規則: ~EntitySpec
    - Specificationパターンを採用
- Application層
  - サービス
    - 命名規則: ~Service
    - 入力、出力はDTOで管理
      - 入力: ~Command
      - 出力: ~Dto
    - 入力時のオプションはoptions?引数として一括管理
  - ビジネスルール
    - 命名規則: ~AppSpec
    - Specificationパターンを採用
- Infrastructure層
  - DB
    - エンティティ
      - 命名規則: ~DbEntity
      - Drizzleで定義されるDBエンティティ
    - アダプター
      - 命名規則: ~Repository
      - DrizzleでDBを操作する
- Presentation層
  - 基本的には`next-safe-actions`を利用してバックエンドサービスを呼び出す
  - ただし、イベント購読(SSE)のためのエンドポイントはRoute Handlersを作成

# エラー設計
## バックエンドエラーハンドリング
- 本アプリ専用のエラー型（ユーザ通知あり）として`AppError`を作成
- ユーザに通知したい独自のエラー型を定義したい場合は`AppError`を継承して作成する（ユーザ通知が不要の場合はNode.jsの`Error`型を継承して作成する）
- `next-safe-actions`にてエラーを一括ハンドリングする
  - AppErrorであれば、定義に従ってエラーメッセージを返す
  - AppErrorでなければ、「予期せぬエラー」とみなす
  - よって、アプリケーションサービス等でエラーハンドリングをする必要はないので注意する（明確な目的がある場合は、エラーハンドリングを実施する）
- 各処理でエラーをハンドリングする際は`normalizeUnknownError`を活用すること
  - mastraのAIエラーなど様々ハンドリング可能

## フロントエンドエラーハンドリング・表示
- toast通知ライブラリとして`sonner`を採用（shadcn/ui準拠）
- `lib/client/toast.ts`のユーティリティ関数を使用すること
  - `showError(message)` - エラー表示（自動削除されない、ユーザーが手動で閉じる必要あり）
  - `showSuccess(message)` - 成功表示
  - `showInfo(message)` - 情報表示
  - `showWarning(message)` - 警告表示

# ユーザ通知設計
## 通知(SSE)設計
長時間処理などを非同期処理した際の完了通知等で利用する。
概要は以下の通り。
- ユーザごとに特定イベントを購読することができる
- システムからイベントが発行されるとイベントやユーザ単位でSSE通知ができる

実装においては、イベントブローカー、イベント購読Clientのinterfaceと実装を分離して、製品や実装方法に対して柔軟性を持たせる。
現段階においては、インメモリマップを利用したのイベントブローカー、`EventSource`を利用したイベント購読Clientを実装する。

## 通知メッセージ設計
バックエンドのユーザメッセージについては`intl-messageformat`を利用して、一元管理する。
ただし、日本語メッセージのみ取り扱うこととする。

# ログ設計
Pinoを利用。
以下の項目を常に表示する。
- 認証済みユーザ情報
- リクエストID

## エラーログ出力方法
エラーオブジェクトをログ出力する際は、必ず`err`キーを使用すること。
`pino-std-serializers`の`errWithCause`シリアライザーにより、自動的にシリアライズされる。

# 認証設計
next-authを利用。
OIDCで認証する。
JWTセッション管理。
管理者用のページについては`(admin)`ディレクトリ配下に配置する(middleware.tsで制御する)。
インフラ層より下の層に認証の詳細が漏れ出さないように注意。

# AI処理方針
Mastraを利用する。
## Agent構築の注意点
- Agentクラスの構築時はRuntimeContextを利用して、状況に合わせて動的にAgentを生成できるようにする
## Workflow構築の注意点
- step毎にファイルを分ける
- 各stepの入力、出力スキーマはそれぞれのファイル内に記載する
- 各stepは必要最低限の入力、出力スキーマとする
  - stepの処理を簡潔に保ち、見やすくするため/様々なworkflowで再利用できるようにするため
  - workflow構築時に、step時の入力を柔軟に調整できるmapを利用して、各stepの入力、出力スキーマに合わせる
- 出力スキーマについては以下の`baseStepOutputSchema`を全てのstepの出力スキーマのベース（継承元）とする
- エラーハンドリングの際の注意点
  - 各stepではエラーで終了しないように処理の先頭からtry catchで例外を検知する
  - 例外を検知した場合は出力スキーマのstatusを`failed`としてstep処理を終了する
- 完全に期待する結果を得られない場合は、workflowやstepは失敗するように制御
- workflow実行結果を確認する際は`checkWorkflowResult`を利用する
- テストについては、各step毎、workflow全体それぞれ作成すること

# フロントエンド作成方針
- Tailwind CSS、shadcn/uiを利用
- 共通化できるコンポーネントは`next-server/components`に配置
  - なるべく共通化して保守性を高めたい
  - 将来的に共通化しておくと役立ちそうな場合も、こちらに配置しておく
- 機能独自のコンポーネントは`next-server/app/${feature}/components`に配置
- グローバル状態管理が必要な場合は`zustand`を利用
- next.jsのキャッシュ機構を十分考慮して実装

# ファイルテキスト抽出処理作成方針
レビュー対象をドキュメントとしてレビューする場合は、テキスト抽出が必要となる。
ここで抽出されたテキストが最終的にAIに渡されるため、非常に重要である。
- ドキュメントは以下の形式を想定する
  - xlsx,docx,pptx,txt,csv
- 上記の各形式ごとにテキスト抽出処理を用意する
  - 具体的な実装はインフラ層に逃すことで、簡単に抽出処理を入れ替えられるようにする
  - 将来的に外部サービスを利用したテキスト抽出処理（例えば外部サービスによるoffice文書のMDテキスト変換）もオプションとして簡単に利用できるようにするため
- テキスト抽出後の後処理も必要
  - 無駄なテキストはコンテキストの逼迫につながるため
  - electron版の`normalizeExtractedText`を参考にする
- テキスト抽出、抽出後処理をオーケストレーションするクラスも作成
