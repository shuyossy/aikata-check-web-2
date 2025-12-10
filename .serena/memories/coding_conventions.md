# コーディング規約

## 命名規則
- エンティティ: `Example.ts`
- 値オブジェクト: `ExampleId.ts`
- ビジネスルール: `~EntitySpec`（ドメイン層）、`~AppSpec`（アプリケーション層）
- サービス: `~Service`
- リポジトリ: `~Repository`
- DTO: 入力は`~Command`、出力は`~Dto`

## テスト
- Vitest使用
- `describe`は日本語で記述
- `__tests__`ディレクトリに配置
- 正常系・異常系をdescribeで分ける

## エラー
- `AppError`を継承してカスタムエラー作成
- エラーメッセージは`messages/ja/template.ts`に集約

## ログ
- Pino使用
- `getLogger()`で全レイヤーからコンテキスト付きロガー取得可能
- `createContextLogger()`で明示的にコンテキスト指定も可能

## コメント
- 日本語で記載
- プロンプト（AI用）は英語

## その他
- TypeScript型安全
- クリーンアーキテクチャ遵守
- shadcn/ui優先使用
