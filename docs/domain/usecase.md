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
    - KeycloakまたはGitLabで認証済みであること
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

---

## レビュー実行管理

- レビュー実行
  - 識別子: ExecuteReviewService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュースペースが属するプロジェクトのメンバーであること
    - レビュースペースにチェック項目が1件以上存在すること
  - 入力: ExecuteReviewCommand { reviewSpaceId: string, userId: string, files: RawUploadFileMeta[], fileBuffers: FileBuffersMap, reviewSettings: ReviewSettingsInput, reviewType: ReviewType }
    - RawUploadFileMeta: { id: string, name: string, type: string, processMode: "text" | "image" }
    - FileBuffersMap: Map<fileId, { buffer: Buffer, convertedImageBuffers?: Buffer[] }>
    - ReviewSettingsInput: { additionalInstructions?: string, concurrentReviewItems?: number, commentFormat?: string, evaluationCriteria?: EvaluationItemInput[] }
    - ReviewType: "small" | "large" （少量レビュー / 大量レビュー）
  - 出力: ExecuteReviewResult { reviewTargetId: string, status: string }
  - メインフロー
    1. 入力されたレビュースペースIDでレビュースペースの存在を確認する
    2. レビュースペースが属するプロジェクトの存在を確認する
    3. ユーザがプロジェクトのメンバーであることを確認する
    4. レビュースペース配下のチェック項目が1件以上存在することを確認する
    5. チェック項目一覧を取得する
    6. 新規レビュー対象エンティティを作成する（status=pending, reviewSettings保存）
    7. レビュー対象をDBに保存する
    8. レビュー対象のステータスをreviewingに更新する
    9. Mastraレビュー実行ワークフローを非同期で実行する
       - reviewTypeに応じて少量レビューまたは大量レビューの処理フローに分岐する
       - **少量レビュー（small）の場合**
         9.1. ファイル処理ステップ: ドキュメントからテキスト抽出/画像変換
         9.2. 少量レビュー実行ステップ: チェック項目ごとにAIレビューを実行
         9.3. 各チェック項目のレビュー結果をDBに保存する
       - **大量レビュー（large）の場合**
         9.1. ファイル処理ステップ: ドキュメントからテキスト抽出/画像変換
         9.2. 個別ドキュメントレビューステップ: 各ドキュメントを個別にレビュー（コンテキスト長エラー時は分割リトライ）
         9.3. レビュー結果統合ステップ: 個別レビュー結果を統合し、最終評定とコメントを生成
         9.4. 各チェック項目のレビュー結果をDBに保存する
    10. ワークフロー完了後、レビュー対象のステータスをcompletedまたはerrorに更新する
    11. レビュー対象IDとステータスを返却する
  - 例外
    - パターン1: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン2: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン3: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
    - パターン4: ファイルが指定されていない場合
      - ドメインバリデーションエラー（REVIEW_EXECUTION_NO_FILES）を返す
    - パターン5: チェック項目が0件の場合
      - ドメインバリデーションエラー（REVIEW_EXECUTION_NO_CHECKLIST）を返す
    - パターン6: AIワークフロー実行中にエラーが発生した場合
      - レビュー対象のステータスをerrorに更新し、エラーメッセージを含む内部エラーを返す
    - パターン7: 大量レビュー時にコンテキスト長エラーが発生し、分割リトライでも解決しない場合
      - 当該チェック項目にエラーを記録し、他の項目のレビューは続行する
  - 事後処理
    - なし

- レビュー対象取得
  - 識別子: GetReviewTargetService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュー対象が属するプロジェクトのメンバーであること
  - 入力: GetReviewTargetCommand { reviewTargetId: string, userId: string }
  - 出力: GetReviewTargetResult { reviewTarget: ReviewTargetDto, reviewResults: ReviewResultDto[] }
    - ReviewTargetDto: { id: string, reviewSpaceId: string, name: string, status: string, reviewSettings: ReviewSettingsDto | null, createdAt: Date, updatedAt: Date }
    - ReviewResultDto: { id: string, checkListItemId: string, checkListItemContent: string, evaluation: string | null, comment: string | null, errorMessage: string | null }
  - メインフロー
    1. 入力されたレビュー対象IDでレビュー対象の存在を確認する
    2. レビュー対象が属するレビュースペースを取得する
    3. レビュースペースが属するプロジェクトを取得する
    4. ユーザがプロジェクトのメンバーであることを確認する
    5. レビュー対象に紐づくレビュー結果一覧を取得する
    6. チェック項目情報を結合してDTOを生成する
    7. レビュー対象DTOとレビュー結果DTO一覧を返却する
  - 例外
    - パターン1: レビュー対象が存在しない場合
      - ドメインバリデーションエラー（REVIEW_TARGET_NOT_FOUND）を返す
    - パターン2: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン3: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン4: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（REVIEW_TARGET_ACCESS_DENIED）を返す
  - 事後処理
    - なし

- レビュー対象一覧取得
  - 識別子: ListReviewTargetsService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュースペースが属するプロジェクトのメンバーであること
  - 入力: ListReviewTargetsCommand { reviewSpaceId: string, userId: string }
  - 出力: ListReviewTargetsResult { reviewTargets: ReviewTargetListItemDto[] }
    - ReviewTargetListItemDto: { id: string, name: string, status: string, createdAt: Date, updatedAt: Date }
  - メインフロー
    1. 入力されたレビュースペースIDでレビュースペースの存在を確認する
    2. レビュースペースが属するプロジェクトを取得する
    3. ユーザがプロジェクトのメンバーであることを確認する
    4. レビュースペースに紐づくレビュー対象一覧を取得する（作成日時降順）
    5. レビュー対象一覧DTOを返却する
  - 例外
    - パターン1: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン2: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン3: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
  - 事後処理
    - なし

- レビュー対象削除
  - 識別子: DeleteReviewTargetService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュー対象が属するプロジェクトのメンバーであること
  - 入力: DeleteReviewTargetCommand { reviewTargetId: string, userId: string }
  - 出力: void
  - メインフロー
    1. 入力されたレビュー対象IDでレビュー対象の存在を確認する
    2. レビュー対象が属するレビュースペースを取得する
    3. レビュースペースが属するプロジェクトを取得する
    4. ユーザがプロジェクトのメンバーであることを確認する
    5. レビュー対象に紐づくAIタスクを検索する
    6. AIタスクが存在する場合:
       6.1. タスクがPROCESSING状態の場合、ワークフローをキャンセルする（キャンセル中は新規タスクのデキューをブロック）
       6.2. タスクファイルを削除する
       6.3. AIタスクをDBから削除する
    7. レビュードキュメントキャッシュディレクトリを削除する（ファイルシステム）
    8. レビュー対象を削除する（CASCADE削除でレビュー結果、ドキュメントキャッシュ、大量レビュー結果キャッシュもDB上から削除）
  - 例外
    - パターン1: レビュー対象が存在しない場合
      - ドメインバリデーションエラー（REVIEW_TARGET_NOT_FOUND）を返す
    - パターン2: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン3: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン4: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（REVIEW_TARGET_ACCESS_DENIED）を返す
  - 事後処理
    - なし
  - 備考
    - ワークフローキャンセル失敗時は警告ログを記録し、削除処理は続行する

---

## Q&A履歴管理

- Q&A実行
  - 識別子: ExecuteQaService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュー対象が属するプロジェクトのメンバーであること
    - レビュー対象のレビューが完了していること（status=completed）
  - 入力: ExecuteQaCommand { reviewTargetId: string, userId: string, question: string, checklistItemContent: string }
  - 出力: ExecuteQaResult { qaHistoryId: string }
  - メインフロー
    1. 入力されたレビュー対象IDでレビュー対象の存在を確認する
    2. レビュー対象が属するレビュースペースを取得する
    3. レビュースペースが属するプロジェクトを取得する
    4. ユーザがプロジェクトのメンバーであることを確認する
    5. 新規Q&A履歴エンティティを作成する（status=processing）
    6. Q&A履歴をDBに保存する
    7. Q&A履歴IDを即座に返却する（非同期処理のため）
    8. Mastra Q&A実行ワークフローを非同期で開始する
       8.1. 調査計画ステップ: 質問に対する調査計画を立案する
       8.2. ドキュメント調査ステップ: 計画に基づきレビュー結果・ドキュメントキャッシュを調査する（並列処理）
       8.3. 回答生成ステップ: 調査結果を元に回答を生成する（ストリーミング）
    9. ワークフロー進捗をSSEでクライアントに通知する
       - research_start: 調査開始時
       - research_progress: 各ドキュメント調査完了時
       - answer_chunk: 回答生成のストリーミングチャンク
       - complete: 完了時（回答・調査サマリ含む）
       - error: エラー発生時
    10. ワークフロー完了後、Q&A履歴を更新する（回答・調査サマリ・status=completed）
  - 例外
    - パターン1: レビュー対象が存在しない場合
      - ドメインバリデーションエラー（REVIEW_TARGET_NOT_FOUND）を返す
    - パターン2: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン3: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン4: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
    - パターン5: 質問が空の場合
      - ドメインバリデーションエラー（QA_QUESTION_EMPTY）を返す
    - パターン6: チェック項目内容が空の場合
      - ドメインバリデーションエラー（QA_CHECKLIST_ITEM_CONTENT_EMPTY）を返す
    - パターン7: AIワークフロー実行中にエラーが発生した場合
      - Q&A履歴のステータスをerrorに更新し、エラーメッセージを保存する
      - SSEでエラーイベントを通知する
  - 事後処理
    - なし

- Q&A履歴一覧取得
  - 識別子: ListQaHistoriesService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュー対象が属するプロジェクトのメンバーであること
  - 入力: ListQaHistoriesCommand { reviewTargetId: string, userId: string, limit?: number, offset?: number }
  - 出力: ListQaHistoriesResult { items: QaHistoryDto[], total: number }
    - QaHistoryDto: { id: string, question: string, checkListItemContent: string, answer: string | null, researchSummary: ResearchSummaryDto[] | null, status: string, errorMessage: string | null, createdAt: Date }
    - ResearchSummaryDto: { documentName: string, researchContent: string, result: string }
  - メインフロー
    1. 入力されたレビュー対象IDでレビュー対象の存在を確認する
    2. レビュー対象が属するレビュースペースを取得する
    3. レビュースペースが属するプロジェクトを取得する
    4. ユーザがプロジェクトのメンバーであることを確認する
    5. レビュー対象に紐づくQ&A履歴一覧を取得する（作成日時降順）
    6. Q&A履歴一覧DTOと総件数を返却する
  - 例外
    - パターン1: レビュー対象が存在しない場合
      - ドメインバリデーションエラー（REVIEW_TARGET_NOT_FOUND）を返す
    - パターン2: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン3: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン4: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
  - 事後処理
    - なし

---

## レビュースペース管理

- レビュースペース削除
  - 識別子: DeleteReviewSpaceService
  - 前提条件
    - 認証済みユーザであること
    - 対象レビュースペースが属するプロジェクトのメンバーであること
  - 入力: DeleteReviewSpaceCommand { reviewSpaceId: string, userId: string }
  - 出力: void
  - メインフロー
    1. 入力されたレビュースペースIDでレビュースペースの存在を確認する
    2. レビュースペースが属するプロジェクトを取得する
    3. ユーザがプロジェクトのメンバーであることを確認する
    4. レビュースペース内の全レビュー対象を取得する
    5. 各レビュー対象に対してクリーンアップを実行する:
       5.1. レビュー対象に紐づくAIタスクを検索する
       5.2. AIタスクが存在する場合、ワークフローキャンセル・タスクファイル削除・タスク削除を実行
       5.3. レビュードキュメントキャッシュディレクトリを削除する
    6. チェックリスト生成タスク（もしあれば）をキャンセル・削除する
    7. レビュースペースを削除する（CASCADE削除で関連データもDB上から削除）
  - 例外
    - パターン1: レビュースペースが存在しない場合
      - ドメインバリデーションエラー（REVIEW_SPACE_NOT_FOUND）を返す
    - パターン2: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン3: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
  - 事後処理
    - なし
  - 備考
    - ワークフローキャンセル失敗時は警告ログを記録し、削除処理は続行する

---

## プロジェクト管理

- プロジェクト削除
  - 識別子: DeleteProjectService
  - 前提条件
    - 認証済みユーザであること
    - 対象プロジェクトのメンバーまたは管理者であること
  - 入力: DeleteProjectCommand { projectId: string, userId: string, isAdmin: boolean }
  - 出力: void
  - メインフロー
    1. 入力されたプロジェクトIDでプロジェクトの存在を確認する
    2. ユーザがプロジェクトのメンバーまたは管理者であることを確認する
    3. プロジェクト内の全レビュースペースを取得する
    4. 各レビュースペースに対してクリーンアップを実行する:
       4.1. レビュースペース内の全レビュー対象を取得する
       4.2. 各レビュー対象に対してAIタスククリーンアップとキャッシュ削除を実行
       4.3. チェックリスト生成タスクをキャンセル・削除する
    5. プロジェクトを削除する（CASCADE削除で関連データもDB上から削除）
  - 例外
    - パターン1: プロジェクトが存在しない場合
      - ドメインバリデーションエラー（PROJECT_NOT_FOUND）を返す
    - パターン2: プロジェクトへのアクセス権がない場合
      - ドメインバリデーションエラー（PROJECT_ACCESS_DENIED）を返す
  - 事後処理
    - なし
  - 備考
    - ワークフローキャンセル失敗時は警告ログを記録し、削除処理は続行する