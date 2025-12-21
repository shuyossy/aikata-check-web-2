"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { UpdateProjectService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";

const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  apiKey: z.string().optional().nullable(),
});

/**
 * プロジェクトを更新するアクション
 */
export const updateProjectAction = authenticatedAction
  .schema(updateProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();

    const service = new UpdateProjectService(projectRepository, userRepository);
    return service.execute({
      projectId: parsedInput.projectId,
      userId: ctx.auth.userId,
      isAdmin: ctx.auth.isAdmin,
      name: parsedInput.name,
      description: parsedInput.description,
      apiKey: parsedInput.apiKey,
    });
  });
