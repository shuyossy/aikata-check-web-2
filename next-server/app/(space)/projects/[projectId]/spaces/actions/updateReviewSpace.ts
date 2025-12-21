"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { UpdateReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
} from "@/infrastructure/adapter/db";

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
    const projectRepository = new ProjectRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();

    const service = new UpdateReviewSpaceService(
      reviewSpaceRepository,
      projectRepository,
    );

    return service.execute({
      reviewSpaceId: parsedInput.reviewSpaceId,
      userId: ctx.auth.userId,
      name: parsedInput.name,
      description: parsedInput.description,
      defaultReviewSettings: parsedInput.defaultReviewSettings,
    });
  });
