"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { ExportCheckListToCsvService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { EmployeeId } from "@/domain/user";

const exportCheckListToCsvSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * チェックリストをCSV形式でエクスポートするアクション
 */
export const exportCheckListToCsvAction = authenticatedAction
  .schema(exportCheckListToCsvSchema)
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

    const service = new ExportCheckListToCsvService(
      checkListItemRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: user.id.value,
    });
  });
