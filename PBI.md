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
- PBI名: `fileProcessingStep`のリファクタリング
- ステータス: to do
- 背景
  - `fileProcessingStep`はチェックリスト抽出やレビュー実行など様々なworkflpowなど共通して利用するStepであるにも関わらず、`checklistRequirements`というチェックリスト抽出固有の値を入力、出力で利用してしまっている
- 受け入れ基準
  - `fileProcessingStep`で`checklistRequirements`を利用していないこと
  - `fileProcessingStep`を利用しているworkflowに影響を与えない
    - つまり、同じ入力に対して、同じ出力を返すこと
    