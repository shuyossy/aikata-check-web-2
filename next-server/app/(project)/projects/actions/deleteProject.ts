"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { DeleteProjectService } from "@/application/project";
import { ProjectRepository } from "@/infrastructure/adapter/db";

const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
});

/**
 * プロジェクトを削除するアクション
 */
export const deleteProjectAction = authenticatedAction
  .schema(deleteProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    const projectRepository = new ProjectRepository();

    const service = new DeleteProjectService(projectRepository);
    await service.execute({
      projectId: parsedInput.projectId,
      userId: ctx.auth.userId,
      isAdmin: ctx.auth.isAdmin,
    });

    return { success: true };
  });
