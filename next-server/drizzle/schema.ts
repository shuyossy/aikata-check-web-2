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
