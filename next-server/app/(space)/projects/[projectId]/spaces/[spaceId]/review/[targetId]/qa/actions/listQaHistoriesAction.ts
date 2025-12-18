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
import { EmployeeId } from "@/domain/user";

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
    const { auth } = ctx;

    // ユーザーIDを取得
    const userRepository = new UserRepository();
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(auth.employeeId)
    );

    if (!user) {
      throw new Error("ユーザー情報の取得に失敗しました");
    }

    // サービスを初期化
    const listQaHistoriesService = new ListQaHistoriesService(
      new QaHistoryRepository(),
      new ReviewTargetRepository(),
      new ReviewSpaceRepository(),
      new ProjectRepository(),
    );

    // Q&A履歴一覧を取得
    const result = await listQaHistoriesService.execute({
      reviewTargetId,
      userId: user.id.value,
      limit,
      offset,
    });

    return result;
  });
