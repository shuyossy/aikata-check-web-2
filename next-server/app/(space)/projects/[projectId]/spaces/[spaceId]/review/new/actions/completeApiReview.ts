"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { CompleteApiReviewService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { ReviewTargetRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

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
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // サービスを実行
    const service = new CompleteApiReviewService(
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewTargetId,
      userId: user.id.value,
      hasError,
    });

    return {
      reviewTargetId: result.reviewTargetId,
      status: result.status,
    };
  });
