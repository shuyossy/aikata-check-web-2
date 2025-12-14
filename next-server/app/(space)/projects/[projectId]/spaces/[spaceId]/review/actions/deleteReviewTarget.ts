"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/server/baseAction";
import { DeleteReviewTargetService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
  ReviewTargetRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
import { internalError } from "@/lib/server/error";

/**
 * レビュー対象を削除するサーバーアクション
 */
export const deleteReviewTargetAction = authenticatedAction
  .schema(
    z.object({
      reviewTargetId: z.string().uuid(),
      projectId: z.string().uuid(),
      spaceId: z.string().uuid(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId, projectId, spaceId } = parsedInput;

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
    const service = new DeleteReviewTargetService(
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository
    );

    await service.execute({
      reviewTargetId,
      userId: user.id.value,
    });

    // キャッシュを無効化
    revalidatePath(`/projects/${projectId}/spaces/${spaceId}`);

    return { success: true };
  });
