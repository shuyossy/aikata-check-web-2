"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { CancelChecklistGenerationTaskService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { AiTaskRepository } from "@/infrastructure/adapter/db/drizzle/repository/AiTaskRepository";
import { EmployeeId } from "@/domain/user";

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

    const service = new CancelChecklistGenerationTaskService(
      aiTaskRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    await service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: user.id.value,
    });

    // チェックリストページを再検証
    revalidatePath(
      `/projects/${parsedInput.projectId}/spaces/${parsedInput.reviewSpaceId}/checklist`,
    );

    return { success: true };
  });
