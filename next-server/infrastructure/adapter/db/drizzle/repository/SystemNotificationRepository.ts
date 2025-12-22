import { eq, sql, and } from "drizzle-orm";
import {
  ISystemNotificationRepository,
  FindSystemNotificationsOptions,
} from "@/application/shared/port/repository";
import {
  SystemNotification,
  SystemNotificationId,
} from "@/domain/system-notification";
import { db } from "../index";
import { systemNotifications } from "@/drizzle/schema";

/**
 * システム通知リポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class SystemNotificationRepository implements ISystemNotificationRepository {
  /**
   * 通知一覧を取得
   */
  async findAll(
    options?: FindSystemNotificationsOptions,
  ): Promise<SystemNotification[]> {
    const { limit = 50, offset = 0, activeOnly = false } = options ?? {};

    let queryBuilder = db.select().from(systemNotifications);

    if (activeOnly) {
      queryBuilder = queryBuilder.where(
        eq(systemNotifications.isActive, true),
      ) as typeof queryBuilder;
    }

    const result = await queryBuilder
      .orderBy(systemNotifications.displayOrder)
      .limit(limit)
      .offset(offset);

    return result.map((row) =>
      SystemNotification.reconstruct({
        id: row.id,
        message: row.message,
        displayOrder: row.displayOrder,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * アクティブな通知一覧を取得（displayOrder順）
   */
  async findActiveNotifications(): Promise<SystemNotification[]> {
    const result = await db
      .select()
      .from(systemNotifications)
      .where(eq(systemNotifications.isActive, true))
      .orderBy(systemNotifications.displayOrder);

    return result.map((row) =>
      SystemNotification.reconstruct({
        id: row.id,
        message: row.message,
        displayOrder: row.displayOrder,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * IDで通知を取得
   */
  async findById(id: SystemNotificationId): Promise<SystemNotification | null> {
    const result = await db
      .select()
      .from(systemNotifications)
      .where(eq(systemNotifications.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return SystemNotification.reconstruct({
      id: row.id,
      message: row.message,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * 通知を保存（新規作成または更新）
   */
  async save(notification: SystemNotification): Promise<void> {
    const dto = notification.toDto();

    await db
      .insert(systemNotifications)
      .values({
        id: dto.id,
        message: dto.message,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
      })
      .onConflictDoUpdate({
        target: systemNotifications.id,
        set: {
          message: dto.message,
          displayOrder: dto.displayOrder,
          isActive: dto.isActive,
          updatedAt: dto.updatedAt,
        },
      });
  }

  /**
   * 通知を削除
   */
  async delete(id: SystemNotificationId): Promise<void> {
    await db
      .delete(systemNotifications)
      .where(eq(systemNotifications.id, id.value));
  }

  /**
   * 通知の件数をカウント
   */
  async count(activeOnly?: boolean): Promise<number> {
    let queryBuilder = db
      .select({ count: sql<number>`count(*)` })
      .from(systemNotifications);

    if (activeOnly) {
      queryBuilder = queryBuilder.where(
        eq(systemNotifications.isActive, true),
      ) as typeof queryBuilder;
    }

    const result = await queryBuilder;
    return Number(result[0]?.count ?? 0);
  }
}
