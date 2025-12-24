"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { RetryReviewService } from "@/application/reviewTarget";
import { AiTaskQueueService } from "@/application/aiTask";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
  CheckListItemRepository,
  ReviewDocumentCacheRepository,
  AiTaskRepository,
  AiTaskFileMetadataRepository,
  SystemSettingRepository,
} from "@/infrastructure/adapter/db";

/**
 * リトライレビュー実行アクションの入力スキーマ
 */
const retryReviewInputSchema = z.object({
  reviewTargetId: z.string().uuid(),
  retryScope: z.enum(["failed", "all"]),
  useLatestChecklist: z.boolean().optional(),
  reviewType: z.enum(["small", "large"]).optional(),
  reviewSettings: z
    .object({
      additionalInstructions: z.string().nullable().optional(),
      concurrentReviewItems: z.number().optional(),
      commentFormat: z.string().nullable().optional(),
      evaluationCriteria: z
        .array(
          z.object({
            label: z.string(),
            description: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

/**
 * リトライレビューを実行するサーバーアクション
 * キューに登録して即座にレスポンスを返す
 */
export const retryReviewAction = authenticatedAction
  .schema(retryReviewInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const {
      reviewTargetId,
      retryScope,
      useLatestChecklist,
      reviewType,
      reviewSettings,
    } = parsedInput;

    // リポジトリの初期化
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const reviewDocumentCacheRepository = new ReviewDocumentCacheRepository();
    const aiTaskRepository = new AiTaskRepository();
    const aiTaskFileMetadataRepository = new AiTaskFileMetadataRepository();

    // キューサービスを作成
    const aiTaskQueueService = new AiTaskQueueService(
      aiTaskRepository,
      aiTaskFileMetadataRepository,
    );

    // サービスを実行（キューに登録）
    const systemSettingRepository = new SystemSettingRepository();
    const service = new RetryReviewService(
      reviewTargetRepository,
      reviewResultRepository,
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
      reviewDocumentCacheRepository,
      systemSettingRepository,
      aiTaskQueueService,
    );

    const result = await service.execute({
      reviewTargetId,
      userId: ctx.auth.userId,
      employeeId: ctx.auth.employeeId,
      retryScope,
      useLatestChecklist,
      reviewType,
      reviewSettings,
    });

    // キュー登録完了を返す（非同期処理なのでレビュー結果は含まない）
    return {
      reviewTargetId: result.reviewTargetId,
      status: result.status,
      queueLength: result.queueLength,
      retryItems: result.retryItems,
    };
  });
