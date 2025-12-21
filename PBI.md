雛形
```
# ID:
- PBI名: 
- ステータス: [to do/in progress/done]
- ユーザストーリー/背景
- 受け入れ基準
- 注意事項
- 指摘事項（in progressの場合のみ）
```

# ID: 1
- PBI名: runtimecontextのai api管理効率化
- ステータス: to do
- 背景
  - ai apiに関する設定値（apiキー、モデル名、エンドポイント）を動的に決定するためにシステム設定、プロジェクトAPIキー設定等をruntimecontextに入れているが、最終的に利用するapi設定のみ予め決定しておいて、runtimecontextに含めるのが効率的ではないだろうか
  - キューイングする際に利用するapiキーについては確定しているはずである
- 受け入れ基準
  - ai利用処理（AIチェックリスト生成、大量レビュー、少量レビュー、レビューリトライ、QA）についてai apiのruntimecontext設定が最も効率的に設計されていること
  - これに合わせて、workflow実行時のruntimecontext設定、workflow実行中のworkflowのruntimecontextからagentのruntimecontextへの受け渡しが正常に更新されていること
- 注意事項
  - runtimecontextにはagentに関するruntimecontextとworkflowに関するruntimecontextがあるので注意する
  - 参考ファイル
    - `/Users/yoshidashuhei/Documents/vscode_workspace/aikata-check-web/next-server/application/mastra/types.ts`
      - ここにはemployeeIdとaiApiKey,aiApiModel,aiApiURLのみ含めれば良いのではないか？
