"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { internalError } from "@/lib/server/error";
import { GetRetryInfoService } from "@/application/reviewTarget";
import {
  UserRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
  CheckListItemRepository,
  ReviewDocumentCacheRepository,
  ReviewSpaceRepository,
  ProjectRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";

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
    const userRepository = new UserRepository();
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewResultRepository = new ReviewResultRepository();
    const checkListItemRepository = new CheckListItemRepository();
    const reviewDocumentCacheRepository = new ReviewDocumentCacheRepository();
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const projectRepository = new ProjectRepository();

    // employeeIdからuserIdを取得
    const user = await userRepository.findByEmployeeId(
      EmployeeId.create(ctx.auth.employeeId)
    );

    if (!user) {
      throw internalError({ expose: true, messageCode: "USER_SYNC_FAILED" });
    }

    // サービスを実行
    const service = new GetRetryInfoService(
      reviewTargetRepository,
      reviewResultRepository,
      checkListItemRepository,
      reviewDocumentCacheRepository,
      reviewSpaceRepository,
      projectRepository
    );

    const result = await service.execute({
      reviewTargetId,
      userId: user.id.value,
    });

    return result;
  });
