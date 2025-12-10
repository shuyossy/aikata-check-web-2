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