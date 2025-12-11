import { eq, sql, asc, inArray } from "drizzle-orm";
import {
  ICheckListItemRepository,
  FindCheckListItemsOptions,
} from "@/application/shared/port/repository/ICheckListItemRepository";
import { CheckListItem, CheckListItemId } from "@/domain/checkListItem";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { db } from "../index";
import { checkListItems } from "@/drizzle/schema";

/**
 * チェック項目リポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class CheckListItemRepository implements ICheckListItemRepository {
  /**
   * IDでチェック項目を検索
   */
  async findById(id: CheckListItemId): Promise<CheckListItem | null> {
    const result = await db
      .select()
      .from(checkListItems)
      .where(eq(checkListItems.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return CheckListItem.reconstruct({
      id: row.id,
      reviewSpaceId: row.reviewSpaceId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * レビュースペースIDでチェック項目一覧を検索
   */
  async findByReviewSpaceId(
    reviewSpaceId: ReviewSpaceId,
    options?: FindCheckListItemsOptions,
  ): Promise<CheckListItem[]> {
    const { limit = 1000, offset = 0 } = options ?? {};

    const result = await db
      .select()
      .from(checkListItems)
      .where(eq(checkListItems.reviewSpaceId, reviewSpaceId.value))
      .orderBy(asc(checkListItems.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map((row) =>
      CheckListItem.reconstruct({
        id: row.id,
        reviewSpaceId: row.reviewSpaceId,
        content: row.content,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * レビュースペースIDでチェック項目数をカウント
   */
  async countByReviewSpaceId(reviewSpaceId: ReviewSpaceId): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(checkListItems)
      .where(eq(checkListItems.reviewSpaceId, reviewSpaceId.value));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * チェック項目を保存（新規作成または更新）
   */
  async save(item: CheckListItem): Promise<void> {
    const data = {
      id: item.id.value,
      reviewSpaceId: item.reviewSpaceId.value,
      content: item.content.value,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    await db
      .insert(checkListItems)
      .values(data)
      .onConflictDoUpdate({
        target: checkListItems.id,
        set: {
          content: data.content,
          updatedAt: data.updatedAt,
        },
      });
  }

  /**
   * チェック項目を一括保存
   * 既存のチェック項目は全て削除され、新しいチェック項目で置き換えられる
   */
  async bulkSave(
    reviewSpaceId: ReviewSpaceId,
    items: CheckListItem[],
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // 既存のチェック項目を全て削除
      await tx
        .delete(checkListItems)
        .where(eq(checkListItems.reviewSpaceId, reviewSpaceId.value));

      // 新しいチェック項目を挿入
      if (items.length > 0) {
        const data = items.map((item) => ({
          id: item.id.value,
          reviewSpaceId: item.reviewSpaceId.value,
          content: item.content.value,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));

        await tx.insert(checkListItems).values(data);
      }
    });
  }

  /**
   * チェック項目を削除
   */
  async delete(id: CheckListItemId): Promise<void> {
    await db.delete(checkListItems).where(eq(checkListItems.id, id.value));
  }

  /**
   * 複数のチェック項目を削除
   */
  async deleteMany(ids: CheckListItemId[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const idValues = ids.map((id) => id.value);
    await db.delete(checkListItems).where(inArray(checkListItems.id, idValues));
  }

  /**
   * レビュースペースのチェック項目を全て削除
   */
  async deleteByReviewSpaceId(reviewSpaceId: ReviewSpaceId): Promise<void> {
    await db
      .delete(checkListItems)
      .where(eq(checkListItems.reviewSpaceId, reviewSpaceId.value));
  }
}
