"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { StartApiReviewService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { ReviewTargetRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

/**
 * レビュー設定のスキーマ
 */
const apiReviewSettingsSchema = z.object({
  additionalInstructions: z.string().nullable().optional(),
  concurrentReviewItems: z.number().optional(),
  commentFormat: z.string().nullable().optional(),
  evaluationCriteria: z.array(z.object({
    label: z.string(),
    description: z.string(),
  })).optional(),
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
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const reviewTargetRepository = new ReviewTargetRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

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
      userId: user.id.value,
      reviewSettings,
    });

    return {
      reviewTargetId: result.reviewTargetId,
      checkListItems: result.checkListItems,
      concurrentReviewItems: result.concurrentReviewItems,
    };
  });
