"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";

const getReviewSpaceSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * レビュースペースを取得するアクション
 */
export const getReviewSpaceAction = authenticatedAction
  .schema(getReviewSpaceSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();

    const service = new GetReviewSpaceService(
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
    });
  });
