# 推奨コマンド

## 開発
```bash
cd next-server
npm run dev      # 開発サーバー起動
```

## ビルド
```bash
npm run build    # プロダクションビルド
```

## テスト
```bash
npm test                        # 全テスト実行
npm test -- path/to/test.ts    # 特定テスト実行
npm run test:coverage          # カバレッジ付きテスト
```

## リント・フォーマット
```bash
npm run lint     # ESLint実行
npm run format   # Prettier実行
```

## データベース
```bash
npm run db:generate  # マイグレーションファイル生成
npm run db:push      # スキーマをDBに反映
npm run db:migrate   # マイグレーション実行
```

## 型チェック
```bash
npx tsc --noEmit    # 型チェックのみ（注: 既知の外部ライブラリ警告あり）
```
