"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { UpdateProjectMembersService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

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

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new UpdateProjectMembersService(projectRepository, userRepository);
    return service.execute({
      projectId: parsedInput.projectId,
      userId: user.id.value,
      memberIds: parsedInput.memberIds,
    });
  });
