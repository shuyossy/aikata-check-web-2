"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { GetProjectService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

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

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new GetProjectService(projectRepository, userRepository);
    return service.execute({
      projectId: parsedInput.projectId,
      userId: user.id.value,
    });
  });
