import { eq, sql } from "drizzle-orm";
import { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import { ReviewTargetId, ReviewDocumentCache } from "@/domain/reviewTarget";
import { db } from "../index";
import { reviewDocumentCaches } from "@/drizzle/schema";

/**
 * レビュードキュメントキャッシュリポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class ReviewDocumentCacheRepository
  implements IReviewDocumentCacheRepository
{
  /**
   * レビュー対象IDでドキュメントキャッシュ一覧を検索
   */
  async findByReviewTargetId(
    reviewTargetId: ReviewTargetId,
  ): Promise<ReviewDocumentCache[]> {
    const result = await db
      .select()
      .from(reviewDocumentCaches)
      .where(eq(reviewDocumentCaches.reviewTargetId, reviewTargetId.value));

    return result.map((row) =>
      ReviewDocumentCache.reconstruct({
        id: row.id,
        reviewTargetId: row.reviewTargetId,
        fileName: row.fileName,
        processMode: row.processMode,
        cachePath: row.cachePath,
        createdAt: row.createdAt,
      }),
    );
  }

  /**
   * ドキュメントキャッシュを保存（新規作成または更新）
   */
  async save(cache: ReviewDocumentCache): Promise<void> {
    const data = {
      id: cache.id.value,
      reviewTargetId: cache.reviewTargetId.value,
      fileName: cache.fileName,
      processMode: cache.processMode,
      cachePath: cache.cachePath,
      createdAt: cache.createdAt,
    };

    await db
      .insert(reviewDocumentCaches)
      .values(data)
      .onConflictDoUpdate({
        target: reviewDocumentCaches.id,
        set: {
          cachePath: data.cachePath,
        },
      });
  }

  /**
   * 複数のドキュメントキャッシュを一括保存
   */
  async saveMany(caches: ReviewDocumentCache[]): Promise<void> {
    if (caches.length === 0) return;

    const dataList = caches.map((cache) => ({
      id: cache.id.value,
      reviewTargetId: cache.reviewTargetId.value,
      fileName: cache.fileName,
      processMode: cache.processMode,
      cachePath: cache.cachePath,
      createdAt: cache.createdAt,
    }));

    await db
      .insert(reviewDocumentCaches)
      .values(dataList)
      .onConflictDoUpdate({
        target: reviewDocumentCaches.id,
        set: {
          cachePath: sql`EXCLUDED.cache_path`,
        },
      });
  }

  /**
   * レビュー対象IDに紐づくドキュメントキャッシュを全て削除
   */
  async deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void> {
    await db
      .delete(reviewDocumentCaches)
      .where(eq(reviewDocumentCaches.reviewTargetId, reviewTargetId.value));
  }
}
