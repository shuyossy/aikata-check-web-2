"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { SaveApiReviewResultsService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { ReviewTargetRepository, ReviewResultRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

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
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // サービスを実行
    const service = new SaveApiReviewResultsService(
      reviewTargetRepository,
      reviewResultRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewTargetId,
      userId: user.id.value,
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
