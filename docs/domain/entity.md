# エンティティ
記載フォーマット
```
- エンティティ名
  - 識別子: [英語で記載、実装するクラス名と同じにする]
  - 種類: [エンティティ/値オブジェクト/集約ルート]
  - 不変条件
    - [不変条件(常に守られるべき状態ルール)を箇条書き]
  - 属性
    - [箇条書き]
  - 振る舞い
    - [箇条書き]
```

---

## ユーザ管理

- ユーザID
  - 識別子: UserId
  - 種類: 値オブジェクト
  - 不変条件
    - UUIDv4形式であること
  - 属性
    - value: string - UUID文字列
  - 振る舞い
    - create: 新規UUIDを生成して返却する
    - reconstruct: 既存のUUID文字列から復元する

- 社員ID
  - 識別子: EmployeeId
  - 種類: 値オブジェクト
  - 不変条件
    - 空文字でないこと
    - 255文字以内であること
  - 属性
    - value: string - 社員ID文字列（Keycloakのpreferred_username）
  - 振る舞い
    - create: 文字列から社員IDを生成する
    - reconstruct: 既存の文字列から復元する

- ユーザ
  - 識別子: User
  - 種類: 集約ルート
  - 不変条件
    - ユーザIDは空ではないこと（UUID形式）
    - 社員IDは空ではないこと（255文字以内）
    - ユーザ名は空ではないこと
  - 属性
    - id: UserId - システム内部で利用する一意識別子（UUID）
    - employeeId: EmployeeId - Keycloakから取得する社員ID（preferred_username）
    - displayName: string - Keycloakから取得する表示名（display_name）
    - createdAt: Date - 作成日時
    - updatedAt: Date - 更新日時
  - 振る舞い
    - create: 新規ユーザを作成する
    - reconstruct: DBから取得したデータからユーザを復元する
    - updateDisplayName: 表示名を更新する（変更時のみupdatedAtも更新）

---

## プロジェクト管理

- プロジェクトID
  - 識別子: ProjectId
  - 種類: 値オブジェクト
  - 不変条件
    - UUIDv4形式であること
  - 属性
    - value: string - UUID文字列
  - 振る舞い
    - create: 新規UUIDを生成して返却する
    - reconstruct: 既存のUUID文字列から復元する

- プロジェクト名
  - 識別子: ProjectName
  - 種類: 値オブジェクト
  - 不変条件
    - 空文字でないこと
    - 100文字以内であること
  - 属性
    - value: string - プロジェクト名
  - 振る舞い
    - create: 文字列からプロジェクト名を生成する
    - reconstruct: 既存の文字列から復元する

- プロジェクト説明
  - 識別子: ProjectDescription
  - 種類: 値オブジェクト
  - 不変条件
    - 1000文字以内であること（nullも許可）
  - 属性
    - value: string | null - プロジェクト説明
  - 振る舞い
    - create: 文字列からプロジェクト説明を生成する（null許可）
    - reconstruct: 既存の文字列から復元する

- 暗号化APIキー
  - 識別子: EncryptedApiKey
  - 種類: 値オブジェクト
  - 不変条件
    - 暗号化済みの文字列であること（nullも許可）
  - 属性
    - encryptedValue: string | null - AES-256で暗号化されたAPIキー
  - 振る舞い
    - fromPlainText: 平文のAPIキーを暗号化して生成する
    - reconstruct: 暗号化済みの文字列から復元する
    - decrypt: 復号化して平文のAPIキーを取得する
    - hasValue: 値が設定されているか確認する

- プロジェクトメンバー
  - 識別子: ProjectMember
  - 種類: エンティティ
  - 不変条件
    - ユーザIDは空ではないこと
  - 属性
    - userId: UserId - メンバーのユーザID
    - createdAt: Date - メンバー追加日時
  - 振る舞い
    - create: 新規メンバーを作成する
    - reconstruct: DBから取得したデータからメンバーを復元する

- プロジェクト
  - 識別子: Project
  - 種類: 集約ルート
  - 不変条件
    - プロジェクトIDは空ではないこと（UUID形式）
    - プロジェクト名は空ではないこと（100文字以内）
    - 説明は1000文字以内であること
    - 少なくとも1人のメンバーが存在すること
  - 属性
    - id: ProjectId - プロジェクトID
    - name: ProjectName - プロジェクト名
    - description: ProjectDescription - プロジェクト説明（任意）
    - encryptedApiKey: EncryptedApiKey - 暗号化されたAPIキー（任意）
    - members: ProjectMember[] - プロジェクトメンバー一覧
    - createdAt: Date - 作成日時
    - updatedAt: Date - 更新日時
  - 振る舞い
    - create: 新規プロジェクトを作成する
    - reconstruct: DBから取得したデータからプロジェクトを復元する
    - updateName: プロジェクト名を更新する
    - updateDescription: 説明を更新する
    - updateApiKey: APIキーを更新する
    - addMember: メンバーを追加する
    - removeMember: メンバーを削除する
    - hasMember: 指定ユーザがメンバーか確認する
    - toDto: DTOに変換する
    - toListItemDto: 一覧用DTOに変換する

---

## レビュースペース管理

- レビュースペースID
  - 識別子: ReviewSpaceId
  - 種類: 値オブジェクト
  - 不変条件
    - UUIDv4形式であること
  - 属性
    - value: string - UUID文字列
  - 振る舞い
    - create: 新規UUIDを生成して返却する
    - reconstruct: 既存のUUID文字列から復元する

- レビュースペース名
  - 識別子: ReviewSpaceName
  - 種類: 値オブジェクト
  - 不変条件
    - 空文字でないこと
    - 100文字以内であること
  - 属性
    - value: string - レビュースペース名
  - 振る舞い
    - create: 文字列からレビュースペース名を生成する
    - reconstruct: 既存の文字列から復元する

- レビュースペース説明
  - 識別子: ReviewSpaceDescription
  - 種類: 値オブジェクト
  - 不変条件
    - 1000文字以内であること（nullも許可）
  - 属性
    - value: string | null - レビュースペース説明
  - 振る舞い
    - create: 文字列からレビュースペース説明を生成する（null許可）
    - reconstruct: 既存の文字列から復元する

- 評定項目
  - 識別子: EvaluationItem
  - 種類: 値オブジェクト
  - 不変条件
    - ラベルは空文字でないこと
    - ラベルは10文字以内であること
    - 説明は空文字でないこと
    - 説明は200文字以内であること
  - 属性
    - label: string - 評定ラベル（例: A, B, C, -）
    - description: string - ラベルの定義・説明
  - 振る舞い
    - create: ラベルと説明から評定項目を生成する
    - reconstruct: 既存のデータから復元する
    - equals: 等価性を比較する
    - toJSON: JSON形式に変換する

- 評定基準
  - 識別子: EvaluationCriteria
  - 種類: 値オブジェクト
  - 不変条件
    - 評定項目は1項目以上であること
    - 評定項目は10項目以内であること
    - ラベルは重複しないこと
  - 属性
    - items: EvaluationItem[] - 評定項目のリスト
  - 振る舞い
    - create: 評定項目リストから評定基準を生成する
    - createDefault: デフォルト評定基準（A/B/C/-）を生成する
    - reconstruct: 既存のデータから復元する
    - fromJSON: JSON形式から復元する
    - toJSON: JSON形式に変換する
    - equals: 等価性を比較する

- レビュー設定
  - 識別子: ReviewSettings
  - 種類: 値オブジェクト
  - 不変条件
    - 追加指示は2000文字以内であること（nullも許可）
    - 同時レビュー項目数は1以上100以下であること（nullも許可）
    - コメントフォーマットは2000文字以内であること（nullも許可）
  - 属性
    - additionalInstructions: string | null - AIへの追加指示
    - concurrentReviewItems: number | null - 同時レビュー項目数
    - commentFormat: string | null - コメントフォーマット
    - evaluationCriteria: EvaluationCriteria | null - 評定基準
  - 振る舞い
    - create: レビュー設定を生成する
    - createDefault: デフォルト設定（評定基準のみデフォルト値）を生成する
    - reconstruct: 既存のデータから復元する
    - toDto: DTOに変換する
    - equals: 等価性を比較する

- レビュースペース
  - 識別子: ReviewSpace
  - 種類: 集約ルート
  - 不変条件
    - レビュースペースIDは空ではないこと（UUID形式）
    - プロジェクトIDは空ではないこと（UUID形式）
    - レビュースペース名は空ではないこと（100文字以内）
    - 説明は1000文字以内であること
  - 属性
    - id: ReviewSpaceId - レビュースペースID
    - projectId: ProjectId - 所属プロジェクトID
    - name: ReviewSpaceName - レビュースペース名
    - description: ReviewSpaceDescription - レビュースペース説明（任意）
    - defaultReviewSettings: ReviewSettings | null - 既定のレビュー設定（任意）
    - createdAt: Date - 作成日時
    - updatedAt: Date - 更新日時
  - 振る舞い
    - create: 新規レビュースペースを作成する
    - reconstruct: DBから取得したデータからレビュースペースを復元する
    - updateName: レビュースペース名を更新する
    - updateDescription: 説明を更新する
    - updateDefaultReviewSettings: 既定のレビュー設定を更新する
    - toDto: DTOに変換する
    - toListItemDto: 一覧用DTOに変換する

---

## チェックリスト管理

- チェック項目ID
  - 識別子: CheckListItemId
  - 種類: 値オブジェクト
  - 不変条件
    - UUIDv4形式であること
  - 属性
    - value: string - UUID文字列
  - 振る舞い
    - create: 新規UUIDを生成して返却する
    - reconstruct: 既存のUUID文字列から復元する

- チェック項目内容
  - 識別子: CheckListItemContent
  - 種類: 値オブジェクト
  - 不変条件
    - 空文字でないこと
    - 2000文字以内であること
  - 属性
    - value: string - チェック項目の内容
  - 振る舞い
    - create: 文字列からチェック項目内容を生成する
    - reconstruct: 既存の文字列から復元する

- チェック項目
  - 識別子: CheckListItem
  - 種類: エンティティ
  - 不変条件
    - チェック項目IDは空ではないこと（UUID形式）
    - レビュースペースIDは空ではないこと（UUID形式）
    - チェック項目内容は空ではないこと（2000文字以内）
  - 属性
    - id: CheckListItemId - チェック項目ID
    - reviewSpaceId: ReviewSpaceId - 所属レビュースペースID
    - content: CheckListItemContent - チェック項目内容
    - createdAt: Date - 作成日時
    - updatedAt: Date - 更新日時
  - 振る舞い
    - create: 新規チェック項目を作成する
    - reconstruct: DBから取得したデータからチェック項目を復元する
    - updateContent: チェック項目内容を更新する
    - toDto: DTOに変換する
    - toListItemDto: 一覧用DTOに変換する