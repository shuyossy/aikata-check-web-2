# ユースケース
記載フォーマット
```
- ユースケース名
  - 識別子: [英語で記載、実装するクラス名と同じにする] ※~Serviceとすること
  - 前提条件
    - [箇条書き]
  - 入力: [入力内容を簡潔に記載]
  - 出力: [出力内容を簡潔に記載]
  - メインフロー
    1. [番号付き箇条書き]
  - 例外
    - パターン1: [条件を記載]
      - [結果(アクション)を箇条書き]
    - パターン2: ...
  - 事後処理
    - [事後処理があれば箇条書きで記載]
```

---

## ユーザ管理

- ユーザ同期
  - 識別子: SyncUserService
  - 前提条件
    - Keycloakで認証済みであること
  - 入力: SyncUserCommand { employeeId: string, displayName: string }
  - 出力: UserDto { id: string, employeeId: string, displayName: string }
  - メインフロー
    1. 入力された社員IDからEmployeeId値オブジェクトを生成する
    2. 社員IDでユーザリポジトリを検索する
    3. ユーザが存在しない場合、新規Userエンティティを作成し保存する
    4. ユーザが存在する場合、表示名が異なれば更新して保存する
    5. UserDtoを生成して返却する
  - 例外
    - パターン1: 社員IDが空の場合
      - ドメインバリデーションエラー（EMPLOYEE_ID_EMPTY）を返す
    - パターン2: 社員IDが255文字超過の場合
      - ドメインバリデーションエラー（EMPLOYEE_ID_TOO_LONG）を返す
    - パターン3: リポジトリでエラーが発生した場合
      - 内部エラーとしてスローする
  - 事後処理
    - なし

---

## チェックリスト管理

- チェックリストCSV出力
  - 識別子: ExportCheckListToCsvService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュースペースが属するプロジェクトのメンバーであること
  - 入力: ExportCheckListToCsvCommand { reviewSpaceId: string, userId: string }
  - 出力: ExportCheckListToCsvResult { csvContent: string, exportedCount: number }
  - メインフロー
    1. 入力されたレビュースペースIDでレビュースペースの存在を確認する
    2. レビュースペースが属するプロジェクトの存在を確認する
    3. ユーザがプロジェクトのメンバーであることを確認する
    4. レビュースペース配下のチェック項目数を確認する
    5. チェック項目一覧を取得する
    6. チェック項目をCSV形式（ヘッダなし、1列目にチェック項目内容）に変換する
    7. UTF-8 BOMを付与してCSVコンテンツを返却する
  - 例外
    - パターン1: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン2: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン3: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
    - パターン4: チェック項目が0件の場合
      - 内部エラー（CHECK_LIST_EXPORT_NO_ITEMS）を返す
    - パターン5: チェック項目数が上限を超えている場合
      - 内部エラー（CHECK_LIST_EXPORT_TOO_MANY_ITEMS）を返す
  - 事後処理
    - なし

- AIチェックリスト生成
  - 識別子: GenerateCheckListByAIService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュースペースが属するプロジェクトのメンバーであること
  - 入力: GenerateCheckListByAICommand { reviewSpaceId: string, userId: string, files: ProcessedFile[], checklistRequirements: string }
    - ProcessedFile: { id: string, name: string, type: string, processMode: "text" | "image", textContent?: string, imageData?: string[] }
  - 出力: GenerateCheckListByAIResult { generatedCount: number, items: string[] }
  - メインフロー
    1. 入力されたレビュースペースIDでレビュースペースの存在を確認する
    2. レビュースペースが属するプロジェクトの存在を確認する
    3. ユーザがプロジェクトのメンバーであることを確認する
    4. Mastraチェックリスト生成ワークフローを実行する
       4.1. トピック抽出ステップ: ドキュメントから独立したトピックを抽出する
       4.2. トピック別チェックリスト作成ステップ: 各トピックに対してチェックリスト項目を生成する（並列処理）
    5. 生成されたチェック項目をレビュースペースに保存する
    6. 生成結果を返却する
  - 例外
    - パターン1: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン2: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン3: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
    - パターン4: ファイルが指定されていない場合
      - ドメインバリデーションエラー（AI_CHECKLIST_GENERATION_NO_FILES）を返す
    - パターン5: チェックリスト生成要件が空の場合
      - ドメインバリデーションエラー（AI_CHECKLIST_GENERATION_REQUIREMENTS_EMPTY）を返す
    - パターン6: AIワークフロー実行中にエラーが発生した場合
      - ワークフローからのエラーメッセージを含む内部エラーを返す
    - パターン7: チェック項目が1件も生成されなかった場合
      - 内部エラー（AI_CHECKLIST_GENERATION_NO_ITEMS_GENERATED）を返す
  - 事後処理
    - なし