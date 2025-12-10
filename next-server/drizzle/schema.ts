import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

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
