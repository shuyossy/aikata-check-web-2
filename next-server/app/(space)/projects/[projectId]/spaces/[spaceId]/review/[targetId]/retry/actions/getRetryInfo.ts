"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { GetRetryInfoService } from "@/application/reviewTarget";
import {
  ReviewTargetRepository,
  ReviewResultRepository,
  CheckListItemRepository,
  ReviewDocumentCacheRepository,
  ReviewSpaceRepository,
  ProjectRepository,
} from "@/infrastructure/adapter/db";

/**
 * リトライ情報取得アクションの入力スキーマ
 */
const getRetryInfoInputSchema = z.object({
  reviewTargetId: z.string().uuid(),
});

/**
 * リトライ情報を取得するサーバーアクション
 */
export const getRetryInfoAction = authenticatedAction
  .schema(getRetryInfoInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId } = parsedInput;

    // リポジトリの初期化
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const reviewDocumentCacheRepository = new ReviewDocumentCacheRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const projectRepository = new ProjectRepository();

    // サービスを実行
    const service = new GetRetryInfoService(
      reviewTargetRepository,
      reviewResultRepository,
      checkListItemRepository,
      reviewDocumentCacheRepository,
      reviewSpaceRepository,
      projectRepository,
    );

    const result = await service.execute({
      reviewTargetId,
      userId: ctx.auth.userId,
    });

    return result;
  });
