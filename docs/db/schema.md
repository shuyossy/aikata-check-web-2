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
| default_review_settings | JSONB | NULL | - | 既定のレビュー設定（JSON形式） |
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
- **default_review_settings**: レビュースペースの既定のレビュー設定をJSONB形式で保存。任意項目のためNULL許可。新規レビュー実行時にデフォルト値として使用される。
- **created_at/updated_at**: 監査目的で作成日時と更新日時を記録。タイムゾーン付きで国際化に対応。

### default_review_settings JSON構造

```json
{
  "additionalInstructions": "string | null",
  "concurrentReviewItems": "number | null",
  "commentFormat": "string | null",
  "evaluationCriteria": [
    {
      "label": "string",
      "description": "string"
    }
  ] | null
}
```

| プロパティ | 型 | 説明 |
|-----------|------|------|
| additionalInstructions | string \| null | AIへの追加指示（最大2000文字） |
| concurrentReviewItems | number \| null | 同時レビュー項目数（1〜100） |
| commentFormat | string \| null | コメントフォーマット（最大2000文字） |
| evaluationCriteria | array \| null | 評定基準（1〜10項目、ラベル重複不可） |

#### evaluationCriteria 各要素

| プロパティ | 型 | 説明 |
|-----------|------|------|
| label | string | 評定ラベル（1〜10文字）例: A, B, C, - |
| description | string | ラベルの定義・説明（1〜200文字） |

#### デフォルト評定基準

新規作成時のデフォルト値として以下を使用:
- A: 基準を完全に満たしている
- B: 基準をある程度満たしている
- C: 基準を満たしていない
- -: 評価の対象外、または評価できない

### 備考
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

---

## review_targets テーブル

レビュー対象を管理するテーブル。レビュースペースに対してレビューを実行する際の対象ドキュメントとその実行状態を管理する。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| id | UUID | NOT NULL | gen_random_uuid() | レビュー対象ID（PK） |
| review_space_id | UUID | NOT NULL | - | 所属レビュースペースID（FK → review_spaces.id） |
| name | VARCHAR(255) | NOT NULL | - | レビュー対象名（ファイル名等） |
| status | VARCHAR(20) | NOT NULL | 'pending' | レビューステータス |
| review_type | VARCHAR(10) | NULL | - | レビュー種別（small/large） |
| review_settings | JSONB | NULL | - | レビュー実行時に使用した設定 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード更新日時 |

### インデックス
- PRIMARY KEY (id)
- INDEX idx_review_targets_review_space_id (review_space_id) - スペース配下のレビュー対象一覧取得を高速化
- INDEX idx_review_targets_status (status) - ステータス別のフィルタリングを高速化

### 外部キー制約
- review_space_id → review_spaces.id (ON DELETE CASCADE)

### 設計思想
- **id**: UUIDを採用し、レビュー対象を一意に識別する。URLパラメータとしても使用される。
- **review_space_id**: レビュー対象が所属するレビュースペースへの参照。CASCADE削除によりスペース削除時に関連するレビュー対象も自動的に削除される。
- **name**: レビュー対象を識別するための名称。複数ファイルの場合はスラッシュ区切りで結合（例: "doc1.docx/doc2.xlsx"）。255文字以内に制限。
- **status**: レビュー処理の進行状態を表す。以下の値を取る:
  - `pending`: レビュー待ち（初期状態）
  - `reviewing`: レビュー実行中
  - `completed`: レビュー完了
  - `error`: レビュー失敗
- **review_type**: レビュー種別。リトライ時に同じ種別で再実行するために使用。以下の値を取る:
  - `small`: 少量レビュー（ドキュメントがコンテキストに収まる場合）
  - `large`: 大量レビュー（ドキュメントを分割して処理する場合）
  - NULL: 未設定（リトライ不可）
- **review_settings**: レビュー実行時に使用した設定をJSONB形式で保存。リトライ時に同じ設定で再実行するために使用。構造はreview_spaces.default_review_settingsと同一。
- **created_at/updated_at**: 監査目的で作成日時と更新日時を記録。

### 備考
- 同一レビュースペースに対して複数のレビュー対象を作成可能。
- レビュー対象はレビュースペースのチェックリストを使用してレビューされる。

---

## review_results テーブル

レビュー結果を管理するテーブル。レビュー対象に対する各チェック項目ごとのAIレビュー結果を保存する。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| id | UUID | NOT NULL | gen_random_uuid() | レビュー結果ID（PK） |
| review_target_id | UUID | NOT NULL | - | レビュー対象ID（FK → review_targets.id） |
| check_list_item_id | UUID | NOT NULL | - | チェック項目ID（FK → check_list_items.id） |
| evaluation | VARCHAR(20) | NULL | - | 評定（A, B, C, -, カスタムラベル等） |
| comment | TEXT | NULL | - | AIが生成したレビューコメント |
| error_message | TEXT | NULL | - | エラー発生時のエラーメッセージ |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード更新日時 |

### インデックス
- PRIMARY KEY (id)
- INDEX idx_review_results_review_target_id (review_target_id) - レビュー対象のレビュー結果一覧取得を高速化
- UNIQUE INDEX idx_review_results_target_item (review_target_id, check_list_item_id) - 同一レビュー対象・チェック項目の重複防止

### 外部キー制約
- review_target_id → review_targets.id (ON DELETE CASCADE)
- check_list_item_id → check_list_items.id (ON DELETE CASCADE)

### 設計思想
- **id**: UUIDを採用し、レビュー結果を一意に識別する。
- **review_target_id**: レビュー結果が紐づくレビュー対象への参照。CASCADE削除によりレビュー対象削除時に関連するレビュー結果も自動的に削除される。
- **check_list_item_id**: レビュー結果が紐づくチェック項目への参照。CASCADE削除によりチェック項目削除時に関連するレビュー結果も自動的に削除される。
- **evaluation**: AIが判定した評定。review_settingsで指定された評定基準のラベルが設定される。NULL許可（レビュー失敗時）。
- **comment**: AIが生成したレビューコメント。review_settingsで指定されたコメントフォーマットに従う。NULL許可（レビュー失敗時）。
- **error_message**: 個別のチェック項目のレビューが失敗した場合のエラーメッセージ。正常完了時はNULL。
- **created_at/updated_at**: 監査目的で作成日時と更新日時を記録。

### 備考
- 1つのレビュー対象に対して、レビュースペースのチェック項目数分のレビュー結果が作成される。
- UNIQUE制約により、同一レビュー対象・チェック項目の組み合わせは1レコードのみ。UPSERT操作でリトライ時に上書き可能。
- error_messageが設定されている場合、UIではエラーアイコンを表示し、コメント欄にエラーメッセージを表示する。

---

## review_document_caches テーブル

レビュー対象ドキュメントのキャッシュ情報を管理するテーブル。リトライ時にドキュメントの再処理を省略するために使用。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|------|------|-----------|------|
| id | UUID | NOT NULL | gen_random_uuid() | キャッシュID（PK） |
| review_target_id | UUID | NOT NULL | - | レビュー対象ID（FK → review_targets.id） |
| file_name | VARCHAR(255) | NOT NULL | - | ファイル名 |
| process_mode | VARCHAR(10) | NOT NULL | - | 処理モード（text/image） |
| cache_path | TEXT | NULL | - | キャッシュファイルのパス |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | レコード作成日時 |

### インデックス
- PRIMARY KEY (id)
- INDEX idx_review_document_caches_review_target_id (review_target_id) - レビュー対象のキャッシュ一覧取得を高速化

### 外部キー制約
- review_target_id → review_targets.id (ON DELETE CASCADE)

### 設計思想
- **id**: UUIDを採用し、キャッシュを一意に識別する。
- **review_target_id**: キャッシュが紐づくレビュー対象への参照。CASCADE削除によりレビュー対象削除時に関連するキャッシュも自動的に削除される。
- **file_name**: 元のファイル名を保存。キャッシュの識別とUI表示に使用。
- **process_mode**: ドキュメントの処理モード。`text`（テキスト抽出）または`image`（画像変換）。
- **cache_path**: サーバ上のキャッシュファイルのパス。環境変数で指定されたキャッシュディレクトリ配下に保存。
- **created_at**: キャッシュ作成日時を記録。

### 備考
- このテーブルはPBI-4（リトライ機能）で本格的に使用される。PBI-1ではテーブル構造のみ作成し、キャッシュ保存ロジックは未実装。
- キャッシュファイルの実体はサーバ上のファイルシステムに保存され、cache_pathにそのパスが記録される。
- レビュー対象削除時はDBレコードとファイルシステム上のキャッシュファイルの両方を削除する必要がある。
