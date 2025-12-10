"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { SearchUsersService } from "@/application/project";
import { UserRepository } from "@/infrastructure/adapter/db";

const searchUsersSchema = z.object({
  query: z.string().min(1),
  page: z.number().optional(),
  limit: z.number().optional(),
});

/**
 * ユーザを検索するアクション（プロジェクトメンバー選択用）
 */
export const searchUsersAction = authenticatedAction
  .schema(searchUsersSchema)
  .action(async ({ parsedInput }) => {
    const userRepository = new UserRepository();

    const service = new SearchUsersService(userRepository);
    return service.execute({
      query: parsedInput.query,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });
  });
