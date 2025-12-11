# データベース設計

本ドキュメントはAIKATAアプリケーションのデータベーススキーマ定義です。
各テーブルについてカラムレベルで設計思想や意図を記載しています。

---

## users テーブル

ユーザ情報を管理するテーブル。Keycloakで認証されたユーザの初回ログイン時に自動作成される。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| id | UUID | NOT NULL | gen_random_uuid() | システム内部ID（PK） |
| employee_id | VARCHAR(255) | NOT NULL | - | Keycloakのpreferred_username（社員ID）。UNIQUE制約 |
| display_name | VARCHAR(255) | NOT NULL | - | Keycloakのdisplay_name（表示名） |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード更新日時 |

### インデックス
- PRIMARY KEY (id)
- UNIQUE INDEX idx_users_employee_id (employee_id)

### 設計思想
- **id**: UUIDを採用し、外部キーとして他テーブルから参照される想定。UUIDを使用することで分散環境でもIDの衝突を回避できる。
- **employee_id**: Keycloakから取得する社員ID（preferred_username）。外部システムKeycloakへの依存を明確化。UNIQUE制約により社員IDの一意性を保証し、重複登録を防止する。
- **display_name**: Keycloakから取得する表示名（display_name）。UIでユーザを識別する目的に使用（Keycloak側で変更された場合はログイン時に同期される）。
- **created_at/updated_at**: 監査目的で作成日時と更新日時を記録。タイムゾーン付きで国際化に対応する。

### 備考
- NextAuthのAccountやSessionテーブルは作成しない（JWTセッション戦略を採用するため）。

---

## projects テーブル

プロジェクト情報を管理するテーブル。ユーザは複数のプロジェクトに所属でき、プロジェクト単位でレビュースペースを管理する。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| id | UUID | NOT NULL | gen_random_uuid() | プロジェクトID（PK） |
| name | VARCHAR(100) | NOT NULL | - | プロジェクト名 |
| description | TEXT | NULL | - | プロジェクト説明 |
| encrypted_api_key | TEXT | NULL | - | AES-256で暗号化されたAPIキー |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード更新日時 |

### インデックス
- PRIMARY KEY (id)

### 設計思想
- **id**: UUIDを採用し、プロジェクトを一意に識別する。URLパラメータとしても使用される。
- **name**: プロジェクトを識別するための名称。100文字以内に制限。
- **description**: プロジェクトの詳細説明。任意項目のためNULL許可。
- **encrypted_api_key**: AIレビューに使用するAPIキー。セキュリティのためAES-256で暗号化して保存。任意項目のためNULL許可。暗号化キーは環境変数で管理。
- **created_at/updated_at**: 監査目的で作成日時と更新日時を記録。

---

## project_members テーブル

プロジェクトとユーザの関連を管理する中間テーブル。ユーザは複数のプロジェクトに所属可能。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| project_id | UUID | NOT NULL | - | プロジェクトID（FK → projects.id） |
| user_id | UUID | NOT NULL | - | ユーザID（FK → users.id） |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | メンバー追加日時 |

### インデックス
- PRIMARY KEY (project_id, user_id)
- INDEX idx_project_members_user_id (user_id) - ユーザのプロジェクト一覧取得を高速化

### 外部キー制約
- project_id → projects.id (ON DELETE CASCADE)
- user_id → users.id (ON DELETE CASCADE)

### 設計思想
- **複合主キー**: project_idとuser_idの組み合わせで一意性を保証。同一ユーザの同一プロジェクトへの重複登録を防止。
- **CASCADE削除**: プロジェクトまたはユーザが削除された場合、関連するメンバーシップも自動的に削除される。
- **ロールなし**: 現時点ではメンバー間の権限差はなく、全メンバーがプロジェクトの編集・削除が可能。将来的にロール（admin/member等）が必要になった場合はroleカラムを追加する。
- **created_at**: メンバーがプロジェクトに追加された日時を記録。監査目的。

---

## review_spaces テーブル

レビュースペース情報を管理するテーブル。プロジェクト内で複数のチェックリストを運用するための単位。同一プロジェクト内に複数のレビュースペースを作成可能。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| id | UUID | NOT NULL | gen_random_uuid() | レビュースペースID（PK） |
| project_id | UUID | NOT NULL | - | 所属プロジェクトID（FK → projects.id） |
| name | VARCHAR(100) | NOT NULL | - | スペース名 |
| description | TEXT | NULL | - | スペース説明 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード更新日時 |

### インデックス
- PRIMARY KEY (id)
- INDEX idx_review_spaces_project_id (project_id) - プロジェクト配下のスペース一覧取得を高速化

### 外部キー制約
- project_id → projects.id (ON DELETE CASCADE)

### 設計思想
- **id**: UUIDを採用し、レビュースペースを一意に識別する。URLパラメータとしても使用される。
- **project_id**: レビュースペースが所属するプロジェクトへの参照。CASCADE削除によりプロジェクト削除時に関連するスペースも自動的に削除される。
- **name**: スペースを識別するための名称。100文字以内に制限。例: 「設計書レビュー」「コードレビュー」「テスト仕様レビュー」
- **description**: スペースの詳細説明。任意項目のためNULL許可。
- **created_at/updated_at**: 監査目的で作成日時と更新日時を記録。タイムゾーン付きで国際化に対応。

### 備考
- 将来的に「レビュー時ユーザ設定項目」（追加指示、同時レビュー項目数、コメントフォーマット、評定基準）を追加する可能性がある。
- レビュースペースへのアクセス権限は、所属プロジェクトのメンバーシップに基づいて判定する。

---

## check_list_items テーブル

チェック項目を管理するテーブル。レビュースペースごとにチェックリストを管理する。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| id | UUID | NOT NULL | gen_random_uuid() | チェック項目ID（PK） |
| review_space_id | UUID | NOT NULL | - | 所属レビュースペースID（FK → review_spaces.id） |
| content | TEXT | NOT NULL | - | チェック項目内容 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード更新日時 |

### インデックス
- PRIMARY KEY (id)
- INDEX idx_check_list_items_review_space_id (review_space_id) - スペース配下のチェック項目一覧取得を高速化

### 外部キー制約
- review_space_id → review_spaces.id (ON DELETE CASCADE)

### 設計思想
- **id**: UUIDを採用し、チェック項目を一意に識別する。
- **review_space_id**: チェック項目が所属するレビュースペースへの参照。CASCADE削除によりスペース削除時に関連するチェック項目も自動的に削除される。
- **content**: チェック項目の内容。2000文字以内に制限。レビュー時にAIに渡されるため、適切な長さに収める。
- **created_at/updated_at**: 監査目的で作成日時と更新日時を記録。

### 備考
- electron版の`reviewChecklists`テーブルとは異なり、レビュー履歴ではなくレビュースペースに紐づける設計。
- 表示順序はcreatedAt順（作成順）で固定。将来的に並び替えが必要になった場合はorderカラムを追加する。
