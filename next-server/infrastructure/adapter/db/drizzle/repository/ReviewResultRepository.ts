import { eq, sql } from "drizzle-orm";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewResult, ReviewResultId } from "@/domain/reviewResult";
import { db } from "../index";
import { reviewResults } from "@/drizzle/schema";

/**
 * レビュー結果リポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class ReviewResultRepository implements IReviewResultRepository {
  /**
   * IDでレビュー結果を検索
   */
  async findById(id: ReviewResultId): Promise<ReviewResult | null> {
    const result = await db
      .select()
      .from(reviewResults)
      .where(eq(reviewResults.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return ReviewResult.reconstruct({
      id: row.id,
      reviewTargetId: row.reviewTargetId,
      checkListItemContent: row.checkListItemContent,
      evaluation: row.evaluation,
      comment: row.comment,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * レビュー対象IDでレビュー結果一覧を検索
   */
  async findByReviewTargetId(
    reviewTargetId: ReviewTargetId,
  ): Promise<ReviewResult[]> {
    const result = await db
      .select()
      .from(reviewResults)
      .where(eq(reviewResults.reviewTargetId, reviewTargetId.value));

    return result.map((row) =>
      ReviewResult.reconstruct({
        id: row.id,
        reviewTargetId: row.reviewTargetId,
        checkListItemContent: row.checkListItemContent,
        evaluation: row.evaluation,
        comment: row.comment,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * レビュー対象IDでレビュー結果数をカウント
   */
  async countByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviewResults)
      .where(eq(reviewResults.reviewTargetId, reviewTargetId.value));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * レビュー結果を保存（新規作成または更新）
   */
  async save(reviewResult: ReviewResult): Promise<void> {
    const data = {
      id: reviewResult.id.value,
      reviewTargetId: reviewResult.reviewTargetId.value,
      checkListItemContent: reviewResult.checkListItemContent,
      evaluation: reviewResult.evaluation.value,
      comment: reviewResult.comment.value,
      errorMessage: reviewResult.errorMessage,
      createdAt: reviewResult.createdAt,
      updatedAt: reviewResult.updatedAt,
    };

    await db
      .insert(reviewResults)
      .values(data)
      .onConflictDoUpdate({
        target: reviewResults.id,
        set: {
          evaluation: data.evaluation,
          comment: data.comment,
          errorMessage: data.errorMessage,
          updatedAt: data.updatedAt,
        },
      });
  }

  /**
   * 複数のレビュー結果を一括保存
   */
  async saveMany(results: ReviewResult[]): Promise<void> {
    if (results.length === 0) return;

    const dataList = results.map((reviewResult) => ({
      id: reviewResult.id.value,
      reviewTargetId: reviewResult.reviewTargetId.value,
      checkListItemContent: reviewResult.checkListItemContent,
      evaluation: reviewResult.evaluation.value,
      comment: reviewResult.comment.value,
      errorMessage: reviewResult.errorMessage,
      createdAt: reviewResult.createdAt,
      updatedAt: reviewResult.updatedAt,
    }));

    await db
      .insert(reviewResults)
      .values(dataList)
      .onConflictDoUpdate({
        target: reviewResults.id,
        set: {
          evaluation: sql`EXCLUDED.evaluation`,
          comment: sql`EXCLUDED.comment`,
          errorMessage: sql`EXCLUDED.error_message`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      });
  }

  /**
   * レビュー結果を削除
   */
  async delete(id: ReviewResultId): Promise<void> {
    await db.delete(reviewResults).where(eq(reviewResults.id, id.value));
  }

  /**
   * レビュー対象IDに紐づくレビュー結果を全て削除
   */
  async deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void> {
    await db
      .delete(reviewResults)
      .where(eq(reviewResults.reviewTargetId, reviewTargetId.value));
  }
}
