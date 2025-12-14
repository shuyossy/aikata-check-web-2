"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { RetryReviewService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
  CheckListItemRepository,
  ReviewDocumentCacheRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

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
          })
        )
        .optional(),
    })
    .optional(),
});

/**
 * リトライレビューを実行するサーバーアクション
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
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const reviewDocumentCacheRepository = new ReviewDocumentCacheRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId)
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // サービスを実行
    const service = new RetryReviewService(
      reviewTargetRepository,
      reviewResultRepository,
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
      reviewDocumentCacheRepository
    );

    const result = await service.execute({
      reviewTargetId,
      userId: user.id.value,
      retryScope,
      useLatestChecklist,
      reviewType,
      reviewSettings,
    });

    return {
      reviewTargetId: result.reviewTargetId,
      status: result.status,
      totalItems: result.totalItems,
      retryItems: result.retryItems,
    };
  });
