"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ListUserProjectsService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";

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

    const service = new ListUserProjectsService(
      projectRepository,
      userRepository,
    );
    return service.execute({
      userId: ctx.auth.userId,
      search: parsedInput.search,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });
  });
