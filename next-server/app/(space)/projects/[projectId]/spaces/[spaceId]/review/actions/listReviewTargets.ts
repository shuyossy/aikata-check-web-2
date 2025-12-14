"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ListReviewTargetsService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
  ReviewTargetRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
import { internalError } from "@/lib/server/error";

/**
 * レビュー対象一覧を取得するサーバーアクション
 */
export const listReviewTargetsAction = authenticatedAction
  .schema(
    z.object({
      reviewSpaceId: z.string().uuid(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { reviewSpaceId } = parsedInput;

    // リポジトリの初期化
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId)
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // サービスを実行
    const service = new ListReviewTargetsService(
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository
    );

    const result = await service.execute({
      reviewSpaceId,
      userId: user.id.value,
    });

    return result;
  });
