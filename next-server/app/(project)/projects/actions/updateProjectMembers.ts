"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { UpdateProjectMembersService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";

const updateProjectMembersSchema = z.object({
  projectId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).min(1),
});

/**
 * プロジェクトメンバーを更新するアクション
 */
export const updateProjectMembersAction = authenticatedAction
  .schema(updateProjectMembersSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();

    const service = new UpdateProjectMembersService(
      projectRepository,
      userRepository,
    );
    return service.execute({
      projectId: parsedInput.projectId,
      userId: ctx.auth.userId,
      memberIds: parsedInput.memberIds,
    });
  });
