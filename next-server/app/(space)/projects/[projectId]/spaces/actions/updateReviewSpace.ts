"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { UpdateReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const updateReviewSpaceSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
});

/**
 * レビュースペースを更新するアクション
 */
export const updateReviewSpaceAction = authenticatedAction
  .schema(updateReviewSpaceSchema)
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

    const service = new UpdateReviewSpaceService(
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: user.id.value,
      name: parsedInput.name,
      description: parsedInput.description,
    });
  });
