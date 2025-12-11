"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { CreateReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const createReviewSpaceSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),
});

/**
 * レビュースペースを作成するアクション
 */
export const createReviewSpaceAction = authenticatedAction
  .schema(createReviewSpaceSchema)
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

    const service = new CreateReviewSpaceService(
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      projectId: parsedInput.projectId,
      name: parsedInput.name,
      description: parsedInput.description,
      userId: user.id.value,
    });
  });
