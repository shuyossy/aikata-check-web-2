"use server";

import { z } from "zod";
import { authenticatedAction } from "@/lib/server/baseAction";
import { ExecuteQaService } from "@/application/qaHistory";
import {
  QaHistoryRepository,
  ReviewTargetRepository,
  ReviewSpaceRepository,
  ProjectRepository,
} from "@/infrastructure/adapter/db";

/**
 * Q&A実行アクションの入力スキーマ
 */
const executeQaSchema = z.object({
  /** レビュー対象ID */
  reviewTargetId: z.string().uuid(),
  /** 質問内容 */
  question: z.string().min(1, "質問を入力してください"),
  /** 選択されたチェックリスト項目の内容（複数） */
  checklistItemContents: z.array(z.string().min(1)).min(1, "チェック項目を選択してください"),
});

/**
 * Q&A実行アクション
 * レビュー結果に対する質問をAIに送信し、回答を取得する
 */
export const executeQaAction = authenticatedAction
  .schema(executeQaSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { reviewTargetId, question, checklistItemContents } = parsedInput;

    // サービスを初期化
    // 注意: ExecuteQaServiceはQ&A履歴の作成のみを行う
    // ワークフローの実行はSSE接続確立後にStartQaWorkflowServiceが行う
    const executeQaService = new ExecuteQaService(
      new QaHistoryRepository(),
      new ReviewTargetRepository(),
      new ReviewSpaceRepository(),
      new ProjectRepository(),
    );

    // Q&A実行（複数チェックリスト項目をJSON配列として渡す）
    const result = await executeQaService.execute({
      reviewTargetId,
      question,
      checklistItemContents,
      userId: ctx.auth.userId,
    });

    return {
      qaHistoryId: result.qaHistoryId,
    };
  });
