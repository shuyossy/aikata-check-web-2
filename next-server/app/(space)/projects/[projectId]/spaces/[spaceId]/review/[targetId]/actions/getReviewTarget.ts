"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { GetReviewTargetService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
import { internalError } from "@/lib/server/error";

/**
 * レビュー対象と結果を取得するサーバーアクション
 */
export const getReviewTargetAction = authenticatedAction
  .schema(
    z.object({
      reviewTargetId: z.string().uuid(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId } = parsedInput;

    // リポジトリの初期化
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId)
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // サービスを実行
    const service = new GetReviewTargetService(
      reviewTargetRepository,
      reviewResultRepository,
      reviewSpaceRepository,
      projectRepository
    );

    const result = await service.execute({
      reviewTargetId,
      userId: user.id.value,
    });

    return result;
  });
