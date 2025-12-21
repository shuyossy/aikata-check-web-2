"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ExportCheckListToCsvService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";

const exportCheckListToCsvSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * チェックリストをCSV形式でエクスポートするアクション
 */
export const exportCheckListToCsvAction = authenticatedAction
  .schema(exportCheckListToCsvSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();

    const service = new ExportCheckListToCsvService(
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
    });
  });
