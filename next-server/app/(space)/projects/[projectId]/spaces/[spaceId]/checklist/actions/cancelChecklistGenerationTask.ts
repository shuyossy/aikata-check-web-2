"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/server/baseAction";
import { CancelChecklistGenerationTaskService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";
import { AiTaskRepository } from "@/infrastructure/adapter/db/drizzle/repository/AiTaskRepository";

const cancelChecklistGenerationTaskSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  projectId: z.string().uuid(),
});

/**
 * キャンセル結果
 */
interface CancelResult {
  success: boolean;
}

/**
 * チェックリスト生成タスクをキャンセルするアクション
 */
export const cancelChecklistGenerationTaskAction = authenticatedAction
  .schema(cancelChecklistGenerationTaskSchema)
  .action(async ({ parsedInput, ctx }): Promise<CancelResult> => {
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const aiTaskRepository = new AiTaskRepository();

    const service = new CancelChecklistGenerationTaskService(
      aiTaskRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    await service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
    });

    // チェックリストページを再検証
    revalidatePath(
      `/projects/${parsedInput.projectId}/spaces/${parsedInput.reviewSpaceId}/checklist`,
    );

    return { success: true };
  });
