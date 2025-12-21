"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ListReviewTargetsService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  ReviewTargetRepository,
} from "@/infrastructure/adapter/db";

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
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();

    // サービスを実行
    const service = new ListReviewTargetsService(
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository
    );

    const result = await service.execute({
      reviewSpaceId,
      userId: ctx.auth.userId,
    });

    return result;
  });
