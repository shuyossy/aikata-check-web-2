"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { BulkDeleteCheckListItemsService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";

const bulkDeleteCheckListItemsSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  checkListItemIds: z.array(z.string().uuid()),
});

/**
 * チェック項目を一括削除するアクション
 */
export const bulkDeleteCheckListItemsAction = authenticatedAction
  .schema(bulkDeleteCheckListItemsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();

    const service = new BulkDeleteCheckListItemsService(
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
      checkListItemIds: parsedInput.checkListItemIds,
    });

    return result;
  });
