"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ListReviewSpaceCheckListItemsService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";

const listCheckListItemsSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

/**
 * レビュースペース配下のチェック項目一覧を取得するアクション
 */
export const listCheckListItemsAction = authenticatedAction
  .schema(listCheckListItemsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();

    const service = new ListReviewSpaceCheckListItemsService(
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });
  });
