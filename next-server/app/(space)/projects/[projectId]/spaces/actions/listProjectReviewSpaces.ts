"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { ListProjectReviewSpacesService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const listProjectReviewSpacesSchema = z.object({
  projectId: z.string().uuid(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

/**
 * プロジェクト配下のレビュースペース一覧を取得するアクション
 */
export const listProjectReviewSpacesAction = authenticatedAction
  .schema(listProjectReviewSpacesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new ListProjectReviewSpacesService(
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      projectId: parsedInput.projectId,
      userId: user.id.value,
      search: parsedInput.search,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });
  });
