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

/**
 * 評定項目のスキーマ
 */
const evaluationItemSchema = z.object({
  label: z.string().min(1).max(10),
  description: z.string().min(1).max(200),
});

/**
 * レビュー設定のスキーマ
 */
const reviewSettingsSchema = z.object({
  additionalInstructions: z.string().max(2000).nullable().optional(),
  concurrentReviewItems: z.number().min(1).max(100),
  commentFormat: z.string().min(1).max(2000),
  evaluationCriteria: z.array(evaluationItemSchema).min(1).max(10),
});

const updateReviewSpaceSchema = z.object({
  reviewSpaceId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  defaultReviewSettings: reviewSettingsSchema,
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
      defaultReviewSettings: parsedInput.defaultReviewSettings,
    });
  });
