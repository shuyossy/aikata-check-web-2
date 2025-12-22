"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/server/baseAction";
import { DeleteReviewTargetService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  ReviewTargetRepository,
  AiTaskRepository,
} from "@/infrastructure/adapter/db";

/**
 * レビュー対象を削除するサーバーアクション
 */
export const deleteReviewTargetAction = authenticatedAction
  .schema(
    z.object({
      reviewTargetId: z.string().uuid(),
      projectId: z.string().uuid(),
      spaceId: z.string().uuid(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId, projectId, spaceId } = parsedInput;

    // リポジトリの初期化
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const aiTaskRepository = new AiTaskRepository();

    // サービスを実行
    const service = new DeleteReviewTargetService(
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository,
      aiTaskRepository,
    );

    await service.execute({
      reviewTargetId,
      userId: ctx.auth.userId,
    });

    // キャッシュを無効化
    revalidatePath(`/projects/${projectId}/spaces/${spaceId}`);

    return { success: true };
  });
