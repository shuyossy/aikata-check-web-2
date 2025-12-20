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
- PBI名: AIチェックリスト抽出処理の最終ステップにチェックリストのブラッシュアップのステップを追加する（electron版からの移植）
- ステータス: to do
- 受け入れ基準
  - electron版の`electron-ver/src/mastra/workflows/sourceReview/checklistExtraction.ts`を参考に、チェックリストのブラッシュアップ処理を追加する
  - チェックリスト生成結果はelectron版と同様の処理結果になること
    - 入力されたドキュメントとチェックリスト生成要件に対して、チェックリスト生成wokflowの出力が同一になる
      - ループ処理もあるので注意
      - AI処理のシステムプロンプト、ユーザプロンプトは一致させる必要があるので注意
        - systemプロンプトは各agent定義の`instructions`で指定
        - userプロンプトはgenerateLegacyの引数で指定
    