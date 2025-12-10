"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { ListUserProjectsService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const listUserProjectsSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

/**
 * ユーザのプロジェクト一覧を取得するアクション
 */
export const listUserProjectsAction = authenticatedAction
  .schema(listUserProjectsSchema)
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

    const service = new ListUserProjectsService(projectRepository, userRepository);
    return service.execute({
      userId: user.id.value,
      search: parsedInput.search,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });
  });
