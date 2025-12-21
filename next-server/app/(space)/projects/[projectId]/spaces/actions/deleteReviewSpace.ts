"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { DeleteReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";

const deleteReviewSpaceSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * レビュースペースを削除するアクション
 */
export const deleteReviewSpaceAction = authenticatedAction
  .schema(deleteReviewSpaceSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();

    const service = new DeleteReviewSpaceService(
      reviewSpaceRepository,
      projectRepository,
    );

    await service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
    });

    return { success: true };
  });
