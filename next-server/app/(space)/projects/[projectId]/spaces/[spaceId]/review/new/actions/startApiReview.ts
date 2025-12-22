"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { StartApiReviewService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { ReviewTargetRepository } from "@/infrastructure/adapter/db";

/**
 * レビュー設定のスキーマ
 */
const apiReviewSettingsSchema = z.object({
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
});

/**
 * 外部APIレビュー開始アクションの入力スキーマ
 */
const startApiReviewSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  name: z.string().min(1),
  reviewSettings: apiReviewSettingsSchema.optional(),
});

/**
 * 外部APIレビューを開始するサーバーアクション
 * レビュー対象を作成し、チェックリスト項目を返す
 */
export const startApiReviewAction = authenticatedAction
  .schema(startApiReviewSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { reviewSpaceId, name, reviewSettings } = parsedInput;

    // リポジトリの初期化
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const reviewTargetRepository = new ReviewTargetRepository();

    // サービスを実行
    const service = new StartApiReviewService(
      reviewTargetRepository,
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewSpaceId,
      name,
      userId: ctx.auth.userId,
      reviewSettings,
    });

    return {
      reviewTargetId: result.reviewTargetId,
      checkListItems: result.checkListItems,
      concurrentReviewItems: result.concurrentReviewItems,
    };
  });
