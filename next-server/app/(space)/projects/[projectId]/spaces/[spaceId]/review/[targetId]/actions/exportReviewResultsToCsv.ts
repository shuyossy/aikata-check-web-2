"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { ExportReviewResultsToCsvService } from "@/application/reviewResult";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

const exportReviewResultsToCsvSchema = z.object({
  reviewTargetId: z.string().uuid(),
});

/**
 * レビュー結果をCSV形式でエクスポートするアクション
 */
export const exportReviewResultsToCsvAction = authenticatedAction
  .schema(exportReviewResultsToCsvSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userRepository = new UserRepository();
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId),
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    const service = new ExportReviewResultsToCsvService(
      reviewResultRepository,
      reviewTargetRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewTargetId: parsedInput.reviewTargetId,
      userId: user.id.value,
    });
  });
