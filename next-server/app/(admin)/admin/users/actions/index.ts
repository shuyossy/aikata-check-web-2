"use server";

import { z } from "zod";
import { adminAction } from "@/lib/server/baseAction";
import { UserRepository } from "@/infrastructure/adapter/db";
import {
  ListAdminsService,
  ListAllUsersService,
  GrantAdminService,
  RevokeAdminService,
} from "@/application/admin";

/**
 * 管理者一覧取得アクション
 */
export const listAdminsAction = adminAction.action(async () => {
  const userRepository = new UserRepository();
  const service = new ListAdminsService(userRepository);
  return service.execute();
});

/**
 * 全ユーザ一覧取得アクション（ページング対応）
 */
const listAllUsersSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const listAllUsersAction = adminAction
  .schema(listAllUsersSchema)
  .action(async ({ parsedInput }) => {
    const { page, limit, search } = parsedInput;
    const offset = (page - 1) * limit;

    const userRepository = new UserRepository();
    const service = new ListAllUsersService(userRepository);
    const result = await service.execute({
      limit,
      offset,
      query: search,
    });

    return {
      users: result.users,
      totalCount: result.total,
    };
  });

/**
 * 管理者権限付与アクション
 */
const grantAdminSchema = z.object({
  targetUserId: z.string().uuid(),
});

export const grantAdminAction = adminAction
  .schema(grantAdminSchema)
  .action(async ({ parsedInput }) => {
    const userRepository = new UserRepository();
    const service = new GrantAdminService(userRepository);
    return service.execute({
      targetUserId: parsedInput.targetUserId,
    });
  });

/**
 * 管理者権限削除アクション
 */
const revokeAdminSchema = z.object({
  targetUserId: z.string().uuid(),
});

export const revokeAdminAction = adminAction
  .schema(revokeAdminSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const service = new RevokeAdminService(userRepository);
    return service.execute({
      targetUserId: parsedInput.targetUserId,
      executorUserId: ctx.auth.userId,
    });
  });
