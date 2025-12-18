import { eq, inArray, and } from "drizzle-orm";
import {
  ILargeDocumentResultCacheRepository,
  LargeDocumentResultCache,
  NewLargeDocumentResultCache,
  ChecklistResultWithIndividualResults,
} from "@/application/shared/port/repository/ILargeDocumentResultCacheRepository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { db } from "../index";
import {
  largeDocumentResultCaches,
  reviewDocumentCaches,
  reviewResults,
} from "@/drizzle/schema";

/**
 * 大量ドキュメント結果キャッシュリポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class LargeDocumentResultCacheRepository
  implements ILargeDocumentResultCacheRepository
{
  /**
   * 大量ドキュメント結果キャッシュを保存
   */
  async save(cache: NewLargeDocumentResultCache): Promise<void> {
    await db.insert(largeDocumentResultCaches).values({
      reviewDocumentCacheId: cache.reviewDocumentCacheId,
      reviewResultId: cache.reviewResultId,
      comment: cache.comment,
      totalChunks: cache.totalChunks,
      chunkIndex: cache.chunkIndex,
      individualFileName: cache.individualFileName,
    });
  }

  /**
   * 複数の大量ドキュメント結果キャッシュを一括保存
   */
  async saveMany(caches: NewLargeDocumentResultCache[]): Promise<void> {
    if (caches.length === 0) return;

    const dataList = caches.map((cache) => ({
      reviewDocumentCacheId: cache.reviewDocumentCacheId,
      reviewResultId: cache.reviewResultId,
      comment: cache.comment,
      totalChunks: cache.totalChunks,
      chunkIndex: cache.chunkIndex,
      individualFileName: cache.individualFileName,
    }));

    await db.insert(largeDocumentResultCaches).values(dataList);
  }

  /**
   * レビュー対象IDで大量ドキュメント結果キャッシュを検索
   */
  async findByReviewTargetId(
    reviewTargetId: ReviewTargetId,
  ): Promise<LargeDocumentResultCache[]> {
    // まずレビュー対象に紐づくドキュメントキャッシュIDを取得
    const documentCaches = await db
      .select({ id: reviewDocumentCaches.id })
      .from(reviewDocumentCaches)
      .where(eq(reviewDocumentCaches.reviewTargetId, reviewTargetId.value));

    if (documentCaches.length === 0) return [];

    const documentCacheIds = documentCaches.map((dc) => dc.id);

    // 大量ドキュメント結果キャッシュを検索
    const results = await db
      .select()
      .from(largeDocumentResultCaches)
      .where(
        inArray(largeDocumentResultCaches.reviewDocumentCacheId, documentCacheIds),
      );

    return results.map((row) => ({
      id: row.id,
      reviewDocumentCacheId: row.reviewDocumentCacheId,
      reviewResultId: row.reviewResultId,
      comment: row.comment,
      totalChunks: row.totalChunks,
      chunkIndex: row.chunkIndex,
      individualFileName: row.individualFileName,
      createdAt: row.createdAt,
    }));
  }

  /**
   * レビュー対象IDで大量ドキュメント結果キャッシュを削除
   */
  async deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void> {
    // まずレビュー対象に紐づくドキュメントキャッシュIDを取得
    const documentCaches = await db
      .select({ id: reviewDocumentCaches.id })
      .from(reviewDocumentCaches)
      .where(eq(reviewDocumentCaches.reviewTargetId, reviewTargetId.value));

    if (documentCaches.length === 0) return;

    const documentCacheIds = documentCaches.map((dc) => dc.id);

    // 大量ドキュメント結果キャッシュを削除
    await db
      .delete(largeDocumentResultCaches)
      .where(
        inArray(largeDocumentResultCaches.reviewDocumentCacheId, documentCacheIds),
      );
  }

  /**
   * チェックリスト結果と個別レビュー結果を取得
   * Q&A機能で使用
   */
  async findChecklistResultsWithIndividualResults(
    reviewTargetId: ReviewTargetId,
    checklistItemContents: string[],
  ): Promise<ChecklistResultWithIndividualResults[]> {
    if (checklistItemContents.length === 0) return [];

    // レビュー結果を取得（SQLでフィルタリング）
    const targetReviewResults = await db
      .select()
      .from(reviewResults)
      .where(
        and(
          eq(reviewResults.reviewTargetId, reviewTargetId.value),
          inArray(reviewResults.checkListItemContent, checklistItemContents),
        ),
      );

    if (targetReviewResults.length === 0) return [];

    const reviewResultIds = targetReviewResults.map((r) => r.id);

    // 大量ドキュメント結果キャッシュを取得
    const individualCaches = await db
      .select()
      .from(largeDocumentResultCaches)
      .where(inArray(largeDocumentResultCaches.reviewResultId, reviewResultIds));

    // 結果を組み立て
    return targetReviewResults.map((reviewResult) => {
      // この レビュー結果に紐づく個別レビュー結果を抽出
      const individualResults = individualCaches
        .filter((cache) => cache.reviewResultId === reviewResult.id)
        .map((cache) => ({
          documentId: cache.reviewDocumentCacheId,
          comment: cache.comment,
          individualFileName: cache.individualFileName,
        }));

      return {
        checklistItemContent: reviewResult.checkListItemContent,
        evaluation: reviewResult.evaluation,
        comment: reviewResult.comment,
        individualResults,
      };
    });
  }

  /**
   * ドキュメントキャッシュIDに紐づく最大チャンク数を取得
   * Q&A機能でドキュメント調査時のチャンク数決定に使用
   */
  async getMaxTotalChunksForDocument(documentCacheId: string): Promise<number> {
    const results = await db
      .select({ totalChunks: largeDocumentResultCaches.totalChunks })
      .from(largeDocumentResultCaches)
      .where(eq(largeDocumentResultCaches.reviewDocumentCacheId, documentCacheId));

    if (results.length === 0) {
      return 1; // 履歴がない場合はデフォルトで1チャンク
    }

    // 最大値を返す
    return Math.max(...results.map((r) => r.totalChunks));
  }
}
