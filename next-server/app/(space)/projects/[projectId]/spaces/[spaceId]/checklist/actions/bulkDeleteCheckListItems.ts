"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { BulkDeleteCheckListItemsService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { EmployeeId } from "@/domain/user";
import { revalidatePath } from "next/cache";

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
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const checkListItemRepository = new CheckListItemRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new BulkDeleteCheckListItemsService(
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: user.id.value,
      checkListItemIds: parsedInput.checkListItemIds,
    });

    // キャッシュを無効化
    revalidatePath(`/projects`);

    return result;
  });
