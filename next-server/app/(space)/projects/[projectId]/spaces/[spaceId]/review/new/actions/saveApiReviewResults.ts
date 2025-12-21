"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { SaveApiReviewResultsService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { ReviewTargetRepository, ReviewResultRepository } from "@/infrastructure/adapter/db";

/**
 * 外部APIレビュー結果の入力スキーマ
 */
const apiReviewResultSchema = z.object({
  checkListItemId: z.string(),
  checkListItemContent: z.string(),
  evaluation: z.string(),
  comment: z.string(),
  error: z.string().optional(),
});

/**
 * 外部APIレビュー結果保存アクションの入力スキーマ
 */
const saveApiReviewResultsSchema = z.object({
  reviewTargetId: z.string().uuid(),
  results: z.array(apiReviewResultSchema),
  chunkIndex: z.number().int().min(0),
  totalChunks: z.number().int().min(1),
});

/**
 * 外部APIレビュー結果を保存するサーバーアクション
 * クライアントから送信されるチャンク単位のレビュー結果をDBに保存する
 */
export const saveApiReviewResultsAction = authenticatedAction
  .schema(saveApiReviewResultsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId, results, chunkIndex, totalChunks } = parsedInput;

    // リポジトリの初期化
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();

    // サービスを実行
    const service = new SaveApiReviewResultsService(
      reviewTargetRepository,
      reviewResultRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewTargetId,
      userId: ctx.auth.userId,
      results,
      chunkIndex,
      totalChunks,
    });

    return {
      savedCount: result.savedCount,
      chunkIndex: result.chunkIndex,
      totalChunks: result.totalChunks,
    };
  });
