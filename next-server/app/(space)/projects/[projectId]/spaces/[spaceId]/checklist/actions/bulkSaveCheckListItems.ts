"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { BulkSaveCheckListItemsService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";

const bulkSaveCheckListItemsSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  contents: z.array(z.string().min(1)),
});

/**
 * チェック項目を一括保存するアクション
 */
export const bulkSaveCheckListItemsAction = authenticatedAction
  .schema(bulkSaveCheckListItemsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();

    const service = new BulkSaveCheckListItemsService(
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
      contents: parsedInput.contents,
    });

    return result;
  });
