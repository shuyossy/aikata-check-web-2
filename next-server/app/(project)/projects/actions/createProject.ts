"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { CreateProjectService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),
  apiKey: z.string().optional().nullable(),
  memberIds: z.array(z.string().uuid()).min(1),
});

/**
 * プロジェクトを作成するアクション
 */
export const createProjectAction = authenticatedAction
  .schema(createProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();

    // employeeIdからuserIdを取得して、memberIdsに含まれていることを確認
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // 作成者がメンバーに含まれていない場合は追加
    const memberIds = parsedInput.memberIds.includes(user.id.value)
      ? parsedInput.memberIds
      : [user.id.value, ...parsedInput.memberIds];

    const service = new CreateProjectService(projectRepository, userRepository);
    return service.execute({
      name: parsedInput.name,
      description: parsedInput.description,
      apiKey: parsedInput.apiKey,
      memberIds,
    });
  });
