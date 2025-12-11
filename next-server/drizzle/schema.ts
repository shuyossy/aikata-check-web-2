import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  primaryKey,
  index,
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
