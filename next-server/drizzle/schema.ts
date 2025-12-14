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
