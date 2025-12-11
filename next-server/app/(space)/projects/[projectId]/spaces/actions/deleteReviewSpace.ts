"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { DeleteReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const deleteReviewSpaceSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * レビュースペースを削除するアクション
 */
export const deleteReviewSpaceAction = authenticatedAction
  .schema(deleteReviewSpaceSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new DeleteReviewSpaceService(
      reviewSpaceRepository,
      projectRepository,
    );

    await service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: user.id.value,
    });

    return { success: true };
  });
