import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  primaryKey,
  index,
  uniqueIndex,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * usersテーブル
 * Keycloakで認証されたユーザ情報を管理
 */
export const users = pgTable("users", {
  /** システム内部ID（PK） */
  id: uuid("id").primaryKey().defaultRandom(),
  /** Keycloakのpreferred_username（社員ID） */
  employeeId: varchar("employee_id", { length: 255 }).notNull().unique(),
  /** Keycloakのdisplay_name（表示名） */
  displayName: varchar("display_name", { length: 255 }).notNull(),
  /** 管理者フラグ（デフォルトfalse） */
  isAdmin: boolean("is_admin").notNull().default(false),
  /** レコード作成日時 */
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** レコード更新日時 */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * ユーザテーブルの型定義
 */
export type UserDbEntity = typeof users.$inferSelect;
export type NewUserDbEntity = typeof users.$inferInsert;

/**
 * projectsテーブル
 * プロジェクト情報を管理
 */
export const projects = pgTable("projects", {
  /** プロジェクトID（PK） */
  id: uuid("id").primaryKey().defaultRandom(),
  /** プロジェクト名 */
  name: varchar("name", { length: 100 }).notNull(),
  /** プロジェクト説明 */
  description: text("description"),
  /** AES-256で暗号化されたAPIキー */
  encryptedApiKey: text("encrypted_api_key"),
  /** レコード作成日時 */
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** レコード更新日時 */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * プロジェクトテーブルの型定義
 */
export type ProjectDbEntity = typeof projects.$inferSelect;
export type NewProjectDbEntity = typeof projects.$inferInsert;

/**
 * project_membersテーブル
 * プロジェクトとユーザの関連を管理
 */
export const projectMembers = pgTable(
  "project_members",
  {
    /** プロジェクトID（FK） */
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** ユーザID（FK） */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** メンバー追加日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index("idx_project_members_user_id").on(table.userId),
  ],
);

/**
 * プロジェクトメンバーテーブルの型定義
 */
export type ProjectMemberDbEntity = typeof projectMembers.$inferSelect;
export type NewProjectMemberDbEntity = typeof projectMembers.$inferInsert;

/**
 * review_spacesテーブル
 * レビュースペース情報を管理
 */
export const reviewSpaces = pgTable(
  "review_spaces",
  {
    /** レビュースペースID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属プロジェクトID（FK） */
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** スペース名 */
    name: varchar("name", { length: 100 }).notNull(),
    /** スペース説明 */
    description: text("description"),
    /**
     * 既定のレビュー設定（JSON形式）
     * 構造: {
     *   additionalInstructions: string | null,
     *   concurrentReviewItems: number,
     *   commentFormat: string,
     *   evaluationCriteria: EvaluationItemProps[]
     * }
     */
    defaultReviewSettings: jsonb("default_review_settings").notNull(),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** レコード更新日時 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * チェックリスト生成エラーメッセージ
     * 最新のエラーのみ保持（生成成功時にクリアされる）
     */
    checklistGenerationError: text("checklist_generation_error"),
  },
  (table) => [index("idx_review_spaces_project_id").on(table.projectId)],
);

/**
 * レビュースペーステーブルの型定義
 */
export type ReviewSpaceDbEntity = typeof reviewSpaces.$inferSelect;
export type NewReviewSpaceDbEntity = typeof reviewSpaces.$inferInsert;

/**
 * check_list_itemsテーブル
 * レビュースペースに紐づくチェック項目を管理
 */
export const checkListItems = pgTable(
  "check_list_items",
  {
    /** チェック項目ID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属レビュースペースID（FK） */
    reviewSpaceId: uuid("review_space_id")
      .notNull()
      .references(() => reviewSpaces.id, { onDelete: "cascade" }),
    /** チェック項目内容（最大2000文字） */
    content: text("content").notNull(),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** レコード更新日時 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_check_list_items_review_space_id").on(table.reviewSpaceId)],
);

/**
 * チェック項目テーブルの型定義
 */
export type CheckListItemDbEntity = typeof checkListItems.$inferSelect;
export type NewCheckListItemDbEntity = typeof checkListItems.$inferInsert;

/**
 * review_targetsテーブル
 * レビュー対象（AIレビューの実行単位）を管理
 */
export const reviewTargets = pgTable(
  "review_targets",
  {
    /** レビュー対象ID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属レビュースペースID（FK） */
    reviewSpaceId: uuid("review_space_id")
      .notNull()
      .references(() => reviewSpaces.id, { onDelete: "cascade" }),
    /** レビュー対象名（最大255文字） */
    name: varchar("name", { length: 255 }).notNull(),
    /**
     * レビューステータス
     * pending: 待機中, reviewing: レビュー中, completed: 完了, error: エラー
     */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /**
     * レビュー実行時の設定（JSON形式）
     * 構造: {
     *   additionalInstructions: string | null,
     *   concurrentReviewItems: number,
     *   commentFormat: string,
     *   evaluationCriteria: EvaluationItemProps[]
     * }
     */
    reviewSettings: jsonb("review_settings"),
    /**
     * レビュー種別（small: 少量レビュー, large: 大量レビュー）
     * リトライ時に必要な情報として保存
     */
    reviewType: varchar("review_type", { length: 10 }),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** レコード更新日時 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_review_targets_review_space_id").on(table.reviewSpaceId),
    index("idx_review_targets_status").on(table.status),
  ],
);

/**
 * レビュー対象テーブルの型定義
 */
export type ReviewTargetDbEntity = typeof reviewTargets.$inferSelect;
export type NewReviewTargetDbEntity = typeof reviewTargets.$inferInsert;

/**
 * review_resultsテーブル
 * チェック項目ごとのAIレビュー結果を管理
 */
export const reviewResults = pgTable(
  "review_results",
  {
    /** レビュー結果ID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属レビュー対象ID（FK） */
    reviewTargetId: uuid("review_target_id")
      .notNull()
      .references(() => reviewTargets.id, { onDelete: "cascade" }),
    /**
     * チェック項目内容のスナップショット
     * レビュー実行時点のチェック項目内容を保存
     * チェックリスト項目の削除・編集に影響されない
     */
    checkListItemContent: text("check_list_item_content").notNull(),
    /**
     * 評価ラベル（最大20文字）
     * nullの場合はまだ評価されていない、またはエラー
     */
    evaluation: varchar("evaluation", { length: 20 }),
    /** AIによるレビューコメント */
    comment: text("comment"),
    /** エラーメッセージ（レビュー失敗時） */
    errorMessage: text("error_message"),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** レコード更新日時 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_review_results_review_target_id").on(table.reviewTargetId),
    uniqueIndex("idx_review_results_target_content").on(
      table.reviewTargetId,
      table.checkListItemContent,
    ),
  ],
);

/**
 * レビュー結果テーブルの型定義
 */
export type ReviewResultDbEntity = typeof reviewResults.$inferSelect;
export type NewReviewResultDbEntity = typeof reviewResults.$inferInsert;

/**
 * review_document_cachesテーブル
 * レビュー対象のドキュメントキャッシュを管理（リトライ機能用）
 */
export const reviewDocumentCaches = pgTable(
  "review_document_caches",
  {
    /** キャッシュID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属レビュー対象ID（FK） */
    reviewTargetId: uuid("review_target_id")
      .notNull()
      .references(() => reviewTargets.id, { onDelete: "cascade" }),
    /** 元ファイル名 */
    fileName: varchar("file_name", { length: 255 }).notNull(),
    /** 処理モード（text: テキスト抽出, image: 画像変換） */
    processMode: varchar("process_mode", { length: 10 }).notNull(),
    /** キャッシュファイルパス（サーバ内） */
    cachePath: text("cache_path"),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_review_document_caches_review_target_id").on(table.reviewTargetId),
  ],
);

/**
 * レビュードキュメントキャッシュテーブルの型定義
 */
export type ReviewDocumentCacheDbEntity =
  typeof reviewDocumentCaches.$inferSelect;
export type NewReviewDocumentCacheDbEntity =
  typeof reviewDocumentCaches.$inferInsert;

/**
 * ai_tasksテーブル
 * AI処理タスクのキューを管理
 * APIキー毎にキューを分離し、並列実行数を制御
 */
export const aiTasks = pgTable(
  "ai_tasks",
  {
    /** タスクID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * タスクタイプ
     * small_review: 少量レビュー
     * large_review: 大量レビュー
     * checklist_generation: チェックリスト生成
     */
    taskType: varchar("task_type", { length: 50 }).notNull(),
    /**
     * タスクステータス
     * queued: キュー待機中
     * processing: 処理中
     * completed: 完了
     * failed: 失敗
     */
    status: varchar("status", { length: 20 }).notNull(),
    /**
     * APIキーのSHA-256ハッシュ
     * キュー分離のキーとして使用（セキュリティのためハッシュ化）
     */
    apiKeyHash: text("api_key_hash").notNull(),
    /**
     * 優先度（1-10、値が大きいほど優先）
     * デフォルト: 5（通常優先度）
     */
    priority: integer("priority").notNull().default(5),
    /**
     * タスク実行に必要なペイロード（JSON形式）
     * タスクタイプに応じた必要情報を格納
     */
    payload: jsonb("payload").notNull(),
    /** エラーメッセージ（失敗時） */
    errorMessage: text("error_message"),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** レコード更新日時 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 処理開始日時 */
    startedAt: timestamp("started_at", { withTimezone: true }),
    /** 処理完了日時（成功/失敗どちらでも設定） */
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    // キュー取得時のインデックス（status + api_key_hash + priority）
    index("idx_ai_tasks_queue").on(
      table.status,
      table.apiKeyHash,
      table.priority,
    ),
    // ステータス別のインデックス
    index("idx_ai_tasks_status").on(table.status),
  ],
);

/**
 * AIタスクテーブルの型定義
 */
export type AiTaskDbEntity = typeof aiTasks.$inferSelect;
export type NewAiTaskDbEntity = typeof aiTasks.$inferInsert;

/**
 * ai_task_file_metadataテーブル
 * AIタスクに関連するファイルのメタデータを管理
 * ファイル実体はサーバ内ディレクトリに保存
 */
export const aiTaskFileMetadata = pgTable(
  "ai_task_file_metadata",
  {
    /** ファイルメタデータID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属タスクID（FK） */
    taskId: uuid("task_id")
      .notNull()
      .references(() => aiTasks.id, { onDelete: "cascade" }),
    /** 元ファイル名 */
    fileName: varchar("file_name", { length: 255 }).notNull(),
    /** ファイル保存パス（サーバ内） */
    filePath: text("file_path"),
    /** ファイルサイズ（バイト） */
    fileSize: integer("file_size").notNull(),
    /** MIMEタイプ */
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    /**
     * 処理モード（text: テキスト抽出, image: 画像変換）
     * 画像モードの場合、元ファイルではなく変換済み画像が保存される
     */
    processMode: varchar("process_mode", { length: 10 }).notNull().default("text"),
    /**
     * 変換済み画像数（画像モードの場合のみ）
     * テキストモードの場合は0
     */
    convertedImageCount: integer("converted_image_count").notNull().default(0),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ai_task_file_metadata_task_id").on(table.taskId),
  ],
);

/**
 * AIタスクファイルメタデータテーブルの型定義
 */
export type AiTaskFileMetadataDbEntity =
  typeof aiTaskFileMetadata.$inferSelect;
export type NewAiTaskFileMetadataDbEntity =
  typeof aiTaskFileMetadata.$inferInsert;

/**
 * qa_historiesテーブル
 * レビュー結果に対するQ&A履歴を管理
 */
export const qaHistories = pgTable(
  "qa_histories",
  {
    /** Q&A履歴ID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属レビュー対象ID（FK） */
    reviewTargetId: uuid("review_target_id")
      .notNull()
      .references(() => reviewTargets.id, { onDelete: "cascade" }),
    /** 質問したユーザID（FK） */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 質問内容（最大2000文字） */
    question: text("question").notNull(),
    /**
     * 対象チェック項目内容のスナップショット
     * @メンションで選択されたチェック項目の内容
     */
    checkListItemContent: text("check_list_item_content").notNull(),
    /** AIによる回答（ストリーミング完了後に保存） */
    answer: text("answer"),
    /**
     * 調査サマリー（JSON形式）
     * 構造: [{ documentName: string, researchContent: string, researchResult: string }]
     */
    researchSummary: jsonb("research_summary"),
    /**
     * Q&Aステータス
     * processing: 処理中, completed: 完了, error: エラー
     */
    status: varchar("status", { length: 20 }).notNull().default("processing"),
    /** エラーメッセージ（エラー時） */
    errorMessage: text("error_message"),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** レコード更新日時 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_qa_histories_review_target_id").on(table.reviewTargetId),
    index("idx_qa_histories_user_id").on(table.userId),
    index("idx_qa_histories_created_at").on(table.createdAt),
  ],
);

/**
 * Q&A履歴テーブルの型定義
 */
export type QaHistoryDbEntity = typeof qaHistories.$inferSelect;
export type NewQaHistoryDbEntity = typeof qaHistories.$inferInsert;

/**
 * large_document_result_cachesテーブル
 * 大量レビュー時の個別ドキュメントレビュー結果をキャッシュ
 * Q&A機能で個別結果を参照するために使用
 */
export const largeDocumentResultCaches = pgTable(
  "large_document_result_caches",
  {
    /** キャッシュID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属レビュードキュメントキャッシュID（FK） */
    reviewDocumentCacheId: uuid("review_document_cache_id")
      .notNull()
      .references(() => reviewDocumentCaches.id, { onDelete: "cascade" }),
    /** 所属レビュー結果ID（FK） */
    reviewResultId: uuid("review_result_id")
      .notNull()
      .references(() => reviewResults.id, { onDelete: "cascade" }),
    /** 個別レビューコメント */
    comment: text("comment").notNull(),
    /** チャンク総数（分割時のみ1より大きい） */
    totalChunks: integer("total_chunks").notNull().default(1),
    /** 何番目のチャンクか（0から始まる） */
    chunkIndex: integer("chunk_index").notNull().default(0),
    /** 個別ファイル名（分割時は分割後の名前） */
    individualFileName: varchar("individual_file_name", { length: 255 }).notNull(),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_large_doc_result_cache_doc").on(table.reviewDocumentCacheId),
    index("idx_large_doc_result_cache_result").on(table.reviewResultId),
  ],
);

/**
 * 大量ドキュメント結果キャッシュテーブルの型定義
 */
export type LargeDocumentResultCacheDbEntity =
  typeof largeDocumentResultCaches.$inferSelect;
export type NewLargeDocumentResultCacheDbEntity =
  typeof largeDocumentResultCaches.$inferInsert;

/**
 * system_settingsテーブル
 * システム全体の設定を管理（シングルトン、常に1レコード）
 */
export const systemSettings = pgTable("system_settings", {
  /**
   * 設定ID（PK）
   * シングルトンパターンのため常に1
   */
  id: integer("id").primaryKey().default(1),
  /**
   * AES-256で暗号化されたAPIキー
   * 環境変数のAI_API_KEYを上書きする
   */
  encryptedApiKey: text("encrypted_api_key"),
  /**
   * AI APIのURL
   * 環境変数のAI_API_URLを上書きする
   */
  apiUrl: text("api_url"),
  /**
   * AI APIのモデル名
   * 環境変数のAI_API_MODELを上書きする
   */
  apiModel: varchar("api_model", { length: 255 }),
  /** レコード更新日時 */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * システム設定テーブルの型定義
 */
export type SystemSettingDbEntity = typeof systemSettings.$inferSelect;
export type NewSystemSettingDbEntity = typeof systemSettings.$inferInsert;

/**
 * system_notificationsテーブル
 * 全画面に表示するシステム通知を管理
 */
export const systemNotifications = pgTable(
  "system_notifications",
  {
    /** 通知ID（PK） */
    id: uuid("id").primaryKey().defaultRandom(),
    /** 通知メッセージ */
    message: text("message").notNull(),
    /**
     * 表示順序（小さいほど先に表示）
     * 0が最も優先度が高い
     */
    displayOrder: integer("display_order").notNull().default(0),
    /**
     * 有効フラグ
     * falseの場合は画面に表示されない
     */
    isActive: boolean("is_active").notNull().default(true),
    /** レコード作成日時 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** レコード更新日時 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_system_notifications_display_order").on(table.displayOrder)],
);

/**
 * システム通知テーブルの型定義
 */
export type SystemNotificationDbEntity = typeof systemNotifications.$inferSelect;
export type NewSystemNotificationDbEntity = typeof systemNotifications.$inferInsert;
