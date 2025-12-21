"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import {
  GetChecklistGenerationTaskStatusService,
  type ChecklistGenerationTaskStatusDto,
} from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { AiTaskRepository } from "@/infrastructure/adapter/db/drizzle/repository/AiTaskRepository";

const getChecklistGenerationTaskStatusSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * チェックリスト生成タスクの状態を取得するアクション
 */
export const getChecklistGenerationTaskStatusAction = authenticatedAction
  .schema(getChecklistGenerationTaskStatusSchema)
  .action(async ({ parsedInput, ctx }): Promise<ChecklistGenerationTaskStatusDto> => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const aiTaskRepository = new AiTaskRepository();

    const service = new GetChecklistGenerationTaskStatusService(
      aiTaskRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
    });
  });
