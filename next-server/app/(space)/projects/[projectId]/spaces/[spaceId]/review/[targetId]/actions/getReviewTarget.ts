"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { GetReviewTargetService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
} from "@/infrastructure/adapter/db";

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
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();

    // サービスを実行
    const service = new GetReviewTargetService(
      reviewTargetRepository,
      reviewResultRepository,
      reviewSpaceRepository,
      projectRepository
    );

    const result = await service.execute({
      reviewTargetId,
      userId: ctx.auth.userId,
    });

    return result;
  });
