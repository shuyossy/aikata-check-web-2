"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ListQaHistoriesService } from "@/application/qaHistory";
import {
  QaHistoryRepository,
  ReviewTargetRepository,
  ReviewSpaceRepository,
  ProjectRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";

/**
 * Q&A履歴一覧取得アクションの入力スキーマ
 */
const listQaHistoriesSchema = z.object({
  /** レビュー対象ID */
  reviewTargetId: z.string().uuid(),
  /** 取得件数（デフォルト: 20） */
  limit: z.number().optional(),
  /** オフセット（デフォルト: 0） */
  offset: z.number().optional(),
});

/**
 * Q&A履歴一覧取得アクション
 */
export const listQaHistoriesAction = authenticatedAction
  .schema(listQaHistoriesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId, limit, offset } = parsedInput;

    // サービスを初期化
    const listQaHistoriesService = new ListQaHistoriesService(
      new QaHistoryRepository(),
      new ReviewTargetRepository(),
      new ReviewSpaceRepository(),
      new ProjectRepository(),
      new UserRepository(),
    );

    // Q&A履歴一覧を取得
    const result = await listQaHistoriesService.execute({
      reviewTargetId,
      userId: ctx.auth.userId,
      limit,
      offset,
    });

    return result;
  });
