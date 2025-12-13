"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const getReviewSpaceSchema = z.object({
  reviewSpaceId: z.string().uuid(),
});

/**
 * レビュースペースを取得するアクション
 */
export const getReviewSpaceAction = authenticatedAction
  .schema(getReviewSpaceSchema)
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

    const service = new GetReviewSpaceService(
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: user.id.value,
    });
  });
