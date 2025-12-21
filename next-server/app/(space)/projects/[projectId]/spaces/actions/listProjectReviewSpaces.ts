"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ListProjectReviewSpacesService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";

const listProjectReviewSpacesSchema = z.object({
  projectId: z.string().uuid(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

/**
 * プロジェクト配下のレビュースペース一覧を取得するアクション
 */
export const listProjectReviewSpacesAction = authenticatedAction
  .schema(listProjectReviewSpacesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();

    const service = new ListProjectReviewSpacesService(
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      projectId: parsedInput.projectId,
      userId: ctx.auth.userId,
      search: parsedInput.search,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });
  });
