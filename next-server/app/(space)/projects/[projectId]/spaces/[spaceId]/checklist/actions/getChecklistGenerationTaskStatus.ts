"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import {
  GetChecklistGenerationTaskStatusService,
  type ChecklistGenerationTaskStatusDto,
} from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { AiTaskRepository } from "@/infrastructure/adapter/db/drizzle/repository/AiTaskRepository";
import { EmployeeId } from "@/domain/user";

const getChecklistGenerationTaskStatusSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * チェックリスト生成タスクの状態を取得するアクション
 */
export const getChecklistGenerationTaskStatusAction = authenticatedAction
  .schema(getChecklistGenerationTaskStatusSchema)
  .action(async ({ parsedInput, ctx }): Promise<ChecklistGenerationTaskStatusDto> => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const aiTaskRepository = new AiTaskRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new GetChecklistGenerationTaskStatusService(
      aiTaskRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: user.id.value,
    });
  });
