"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { UpdateProjectService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

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

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new UpdateProjectService(projectRepository, userRepository);
    return service.execute({
      projectId: parsedInput.projectId,
      userId: user.id.value,
      isAdmin: ctx.auth.isAdmin,
      name: parsedInput.name,
      description: parsedInput.description,
      apiKey: parsedInput.apiKey,
    });
  });
