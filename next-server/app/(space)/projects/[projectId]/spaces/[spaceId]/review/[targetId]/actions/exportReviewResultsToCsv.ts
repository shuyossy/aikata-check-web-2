"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ExportReviewResultsToCsvService } from "@/application/reviewResult";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
} from "@/infrastructure/adapter/db";

const exportReviewResultsToCsvSchema = z.object({
  reviewTargetId: z.string().uuid(),
});

/**
 * レビュー結果をCSV形式でエクスポートするアクション
 */
export const exportReviewResultsToCsvAction = authenticatedAction
  .schema(exportReviewResultsToCsvSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();

    const service = new ExportReviewResultsToCsvService(
      reviewResultRepository,
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewTargetId: parsedInput.reviewTargetId,
      userId: ctx.auth.userId,
    });
  });
