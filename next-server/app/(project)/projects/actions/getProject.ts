"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { GetProjectService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";

const getProjectSchema = z.object({
  projectId: z.string().uuid(),
});

/**
 * プロジェクトを取得するアクション
 */
export const getProjectAction = authenticatedAction
  .schema(getProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();

    const service = new GetProjectService(projectRepository, userRepository);
    return service.execute({
      projectId: parsedInput.projectId,
      userId: ctx.auth.userId,
    });
  });
