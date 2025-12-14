import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ReviewResult } from "@/domain/reviewResult";
import type { SingleReviewResult } from "@/application/mastra";

/**
 * レビュー結果保存コールバックを生成するヘルパー関数
 * ExecuteReviewServiceとRetryReviewServiceで共有される
 *
 * @param reviewResultRepository レビュー結果リポジトリ
 * @returns ワークフローに渡すコールバック関数
 */
export function createReviewResultSavedCallback(
  reviewResultRepository: IReviewResultRepository,
) {
  return async (
    results: SingleReviewResult[],
    targetId: string,
  ): Promise<void> => {
    const entities: ReviewResult[] = [];
    for (const result of results) {
      let entity: ReviewResult;
      if (result.errorMessage) {
        entity = ReviewResult.createError({
          reviewTargetId: targetId,
          checkListItemContent: result.checkListItemContent,
          errorMessage: result.errorMessage,
        });
      } else {
        entity = ReviewResult.createSuccess({
          reviewTargetId: targetId,
          checkListItemContent: result.checkListItemContent,
          evaluation: result.evaluation ?? "",
          comment: result.comment ?? "",
        });
      }
      entities.push(entity);
    }
    await reviewResultRepository.saveMany(entities);
  };
}
