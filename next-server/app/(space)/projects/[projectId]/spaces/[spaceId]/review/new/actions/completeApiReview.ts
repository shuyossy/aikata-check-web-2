"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { CompleteApiReviewService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { ReviewTargetRepository } from "@/infrastructure/adapter/db";

/**
 * 外部APIレビュー完了アクションの入力スキーマ
 */
const completeApiReviewSchema = z.object({
  reviewTargetId: z.string().uuid(),
  hasError: z.boolean().optional(),
});

/**
 * 外部APIレビューを完了するサーバーアクション
 * レビュー対象のステータスをcompleted/errorに更新する
 */
export const completeApiReviewAction = authenticatedAction
  .schema(completeApiReviewSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId, hasError } = parsedInput;

    // リポジトリの初期化
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();

    // サービスを実行
    const service = new CompleteApiReviewService(
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewTargetId,
      userId: ctx.auth.userId,
      hasError,
    });

    return {
      reviewTargetId: result.reviewTargetId,
      status: result.status,
    };
  });
