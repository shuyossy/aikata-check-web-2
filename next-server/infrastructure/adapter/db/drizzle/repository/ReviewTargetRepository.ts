import { eq, desc, sql } from "drizzle-orm";
import {
  IReviewTargetRepository,
  FindReviewTargetsOptions,
} from "@/application/shared/port/repository/IReviewTargetRepository";
import { ReviewSpaceId, ReviewSettingsProps } from "@/domain/reviewSpace";
import { ReviewTarget, ReviewTargetId } from "@/domain/reviewTarget";
import { db } from "../index";
import { reviewTargets } from "@/drizzle/schema";

/**
 * レビュー対象リポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class ReviewTargetRepository implements IReviewTargetRepository {
  /**
   * IDでレビュー対象を検索
   */
  async findById(id: ReviewTargetId): Promise<ReviewTarget | null> {
    const result = await db
      .select()
      .from(reviewTargets)
      .where(eq(reviewTargets.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return ReviewTarget.reconstruct({
      id: row.id,
      reviewSpaceId: row.reviewSpaceId,
      name: row.name,
      status: row.status,
      reviewSettings: row.reviewSettings as ReviewSettingsProps | null,
      reviewType: row.reviewType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * レビュースペースIDでレビュー対象一覧を検索
   */
  async findByReviewSpaceId(
    reviewSpaceId: ReviewSpaceId,
    options?: FindReviewTargetsOptions,
  ): Promise<ReviewTarget[]> {
    const { limit = 100, offset = 0, status } = options ?? {};

    // where句を構築
    const whereCondition = status
      ? sql`${reviewTargets.reviewSpaceId} = ${reviewSpaceId.value} AND ${reviewTargets.status} = ${status}`
      : eq(reviewTargets.reviewSpaceId, reviewSpaceId.value);

    const result = await db
      .select()
      .from(reviewTargets)
      .where(whereCondition)
      .orderBy(desc(reviewTargets.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map((row) =>
      ReviewTarget.reconstruct({
        id: row.id,
        reviewSpaceId: row.reviewSpaceId,
        name: row.name,
        status: row.status,
        reviewSettings: row.reviewSettings as ReviewSettingsProps | null,
        reviewType: row.reviewType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * レビュースペースIDでレビュー対象数をカウント
   */
  async countByReviewSpaceId(reviewSpaceId: ReviewSpaceId): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviewTargets)
      .where(eq(reviewTargets.reviewSpaceId, reviewSpaceId.value));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * レビュー対象を保存（新規作成または更新）
   */
  async save(reviewTarget: ReviewTarget): Promise<void> {
    const data = {
      id: reviewTarget.id.value,
      reviewSpaceId: reviewTarget.reviewSpaceId.value,
      name: reviewTarget.name.value,
      status: reviewTarget.status.value,
      reviewSettings: reviewTarget.reviewSettings?.toDto() ?? null,
      reviewType: reviewTarget.reviewType?.value ?? null,
      createdAt: reviewTarget.createdAt,
      updatedAt: reviewTarget.updatedAt,
    };

    await db
      .insert(reviewTargets)
      .values(data)
      .onConflictDoUpdate({
        target: reviewTargets.id,
        set: {
          name: data.name,
          status: data.status,
          reviewSettings: data.reviewSettings,
          reviewType: data.reviewType,
          updatedAt: data.updatedAt,
        },
      });
  }

  /**
   * レビュー対象を削除
   */
  async delete(id: ReviewTargetId): Promise<void> {
    await db.delete(reviewTargets).where(eq(reviewTargets.id, id.value));
  }
}
