import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RuntimeContext } from "@mastra/core/di";
import {
  reviewExecuteAgent,
  reviewExecuteOutputSchema as agentOutputSchema,
} from "../../../agents";
import { baseStepOutputSchema } from "../../schema";
import { extractedFileSchema } from "../../shared";
import { createCombinedMessage } from "../../lib";
import {
  createRuntimeContext,
  judgeFinishReason,
} from "../../../lib/agentUtils";
import { normalizeUnknownError, workflowError } from "@/lib/server/error";
import { formatMessage } from "@/lib/server/messages";
import type { ReviewExecuteAgentRuntimeContext } from "../../../agents";
import {
  checkListItemSchema,
  evaluationCriterionSchema,
  singleReviewResultSchema,
  type ReviewExecutionWorkflowRuntimeContext,
  type SingleReviewResult,
} from "../types";

/**
 * 少量ドキュメントレビューステップの入力スキーマ
 * fileProcessingStepで処理済みのExtractedFileとチェック項目を受け取る
 */
export const smallDocumentReviewInputSchema = z.object({
  files: z.array(extractedFileSchema),
  checkListItems: z.array(checkListItemSchema),
  additionalInstructions: z.string().nullable().optional(),
  commentFormat: z.string().nullable().optional(),
  evaluationCriteria: z.array(evaluationCriterionSchema).optional(),
});

/**
 * 少量ドキュメントレビューステップの出力スキーマ
 */
export const smallDocumentReviewOutputSchema = baseStepOutputSchema.extend({
  reviewResults: z.array(singleReviewResultSchema).optional(),
});

export type SmallDocumentReviewInput = z.infer<
  typeof smallDocumentReviewInputSchema
>;
export type SmallDocumentReviewOutput = z.infer<
  typeof smallDocumentReviewOutputSchema
>;

/**
 * 最大リトライ回数
 * レビュー結果に含まれなかったチェック項目を再度レビューする際の最大試行回数
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * 少量ドキュメントレビューステップ
 * チェック項目ごとにドキュメントをレビューする
 */
export const smallDocumentReviewStep = createStep({
  id: "small-document-review",
  description: "チェック項目ごとにドキュメントをレビューする",
  inputSchema: smallDocumentReviewInputSchema,
  outputSchema: smallDocumentReviewOutputSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
    abortSignal,
  }): Promise<SmallDocumentReviewOutput> => {
    // catch節でアクセスするため、try節の外で変数を定義
    const {
      files,
      checkListItems,
      additionalInstructions,
      commentFormat,
      evaluationCriteria,
    } = inputData;

    // workflowのRuntimeContextから各種設定を取得
    const typedWorkflowRuntimeContext = workflowRuntimeContext as
      | RuntimeContext<ReviewExecutionWorkflowRuntimeContext>
      | undefined;
    const employeeId = typedWorkflowRuntimeContext?.get("employeeId");
    const aiApiKey = typedWorkflowRuntimeContext?.get("aiApiKey");
    const aiApiUrl = typedWorkflowRuntimeContext?.get("aiApiUrl");
    const aiApiModel = typedWorkflowRuntimeContext?.get("aiApiModel");
    const reviewTargetId = typedWorkflowRuntimeContext?.get("reviewTargetId");
    const onReviewResultSaved = typedWorkflowRuntimeContext?.get(
      "onReviewResultSaved",
    );

    // 結果を格納する配列
    const reviewResults: z.infer<typeof singleReviewResultSchema>[] = [];

    try {
      // 評価基準のラベル一覧を取得
      const evaluationLabels =
        evaluationCriteria && evaluationCriteria.length > 0
          ? evaluationCriteria.map((c) => c.label)
          : ["A", "B", "C", "-"];

      // 動的に出力スキーマを作成（評価基準に基づく）
      const evaluationEnum =
        evaluationLabels.length > 0
          ? z.enum([evaluationLabels[0], ...evaluationLabels.slice(1)] as [
              string,
              ...string[],
            ])
          : z.enum(["A", "B", "C", "-"]);

      const dynamicOutputSchema = z.array(
        z.object({
          checklistId: z.number().describe("Checklist item ID"),
          reviewSections: z
            .array(
              z.object({
                fileName: z.string().describe("file name to review"),
                sectionNames: z.array(
                  z.string().describe("section name within the file"),
                ),
              }),
            )
            .describe(
              "files and sections that should be reviewed for evaluation and commenting",
            ),
          comment: z.string().describe("evaluation comment"),
          evaluation: evaluationEnum.describe("evaluation"),
        }),
      );

      let targetChecklistItems = [...checkListItems];
      let attempt = 0;

      // メッセージコンテンツを作成（一度だけ）
      const messageContent = createCombinedMessage(
        files,
        "Please review this document against the provided checklist items",
      );

      // チェックリストリマインダーを作成する関数（1始まりの連番IDを使用してトークン消費を削減）
      const createChecklistReminder = (
        items: typeof checkListItems,
      ): string => {
        return `## Checklist Items to Review:
${items.map((item, index) => `- ID: ${index + 1} - ${item.content}`).join("\n")}

Please review the document against the above checklist items.`;
      };

      // 最大リトライ回数までレビューを繰り返す
      while (attempt < MAX_RETRY_ATTEMPTS && targetChecklistItems.length > 0) {
        // エージェント用のRuntimeContextを作成
        const runtimeContext =
          createRuntimeContext<ReviewExecuteAgentRuntimeContext>({
            checklistItems: targetChecklistItems,
            additionalInstructions: additionalInstructions ?? undefined,
            commentFormat: commentFormat ?? undefined,
            evaluationCriteria: evaluationCriteria ?? undefined,
            employeeId,
            aiApiKey,
            aiApiUrl,
            aiApiModel,
          });

        // チェックリストリマインダーを追加
        const checklistReminder = createChecklistReminder(targetChecklistItems);
        const messageWithReminder = [
          ...messageContent,
          { type: "text" as const, text: checklistReminder },
        ];

        // エージェントを実行
        const result = await reviewExecuteAgent.generateLegacy(
          {
            role: "user",
            content: messageWithReminder,
          },
          {
            output: dynamicOutputSchema,
            runtimeContext,
            abortSignal,
          },
        );

        // finishReasonを確認（トークン上限到達等のエラーを検知）
        const { success: finishSuccess } = judgeFinishReason(
          result.finishReason,
        );
        if (!finishSuccess) {
          throw workflowError("WORKFLOW_AI_API_ERROR");
        }

        // 構造化出力を取得
        const output = result.object;

        // 今回のレビューで取得した結果を一時的に格納
        const newResults: SingleReviewResult[] = [];

        if (output && Array.isArray(output)) {
          // 既にレビュー済みのチェック項目内容を取得
          const existingContents = new Set(
            reviewResults.map((r) => r.checkListItemContent),
          );

          // レビュー結果を格納（重複は追加しない）
          for (const item of output) {
            // AIの出力にはショートID（1始まり連番）が含まれるので、配列インデックスで取得
            const targetItem = targetChecklistItems[item.checklistId - 1];
            if (targetItem && !existingContents.has(targetItem.content)) {
              const reviewResult: SingleReviewResult = {
                checkListItemContent: targetItem.content,
                evaluation: item.evaluation,
                comment: item.comment,
                errorMessage: null,
              };
              reviewResults.push(reviewResult);
              newResults.push(reviewResult);
            }
          }

          // レビューされたショートIDを取得
          const reviewedShortIds = new Set(output.map((r) => r.checklistId));

          // まだレビューされていないチェック項目を抽出（インデックス+1がショートID）
          targetChecklistItems = targetChecklistItems.filter(
            (_, index) => !reviewedShortIds.has(index + 1),
          );
        }

        // 新しいレビュー結果がある場合はDB保存コールバックを呼び出し
        if (newResults.length > 0 && reviewTargetId && onReviewResultSaved) {
          await onReviewResultSaved(newResults, reviewTargetId);
        }

        attempt += 1;
      }

      // リトライ後もレビューされなかったチェック項目はエラーとして記録
      const errorResults: SingleReviewResult[] = [];
      for (const item of targetChecklistItems) {
        const errorResult: SingleReviewResult = {
          checkListItemContent: item.content,
          evaluation: null,
          comment: null,
          errorMessage: formatMessage("WORKFLOW_REVIEW_RESULTS_MISSING"),
        };
        reviewResults.push(errorResult);
        errorResults.push(errorResult);
      }

      // エラー結果もDB保存コールバックで保存
      if (errorResults.length > 0 && reviewTargetId && onReviewResultSaved) {
        await onReviewResultSaved(errorResults, reviewTargetId);
      }

      // 全て失敗した場合
      if (reviewResults.every((r) => r.errorMessage !== null)) {
        return {
          status: "failed",
          errorMessage: formatMessage("WORKFLOW_REVIEW_ALL_FAILED"),
          reviewResults,
        };
      }

      return {
        status: "success",
        reviewResults,
      };
    } catch (error) {
      // エラーを正規化して統一的に処理
      const normalizedError = normalizeUnknownError(error);

      // レビュー未済のチェック項目に対してエラー結果を作成
      const errorResults: SingleReviewResult[] = [];
      const reviewedContents = new Set(
        reviewResults.map((r) => r.checkListItemContent),
      );
      for (const item of checkListItems) {
        if (!reviewedContents.has(item.content)) {
          const errorResult: SingleReviewResult = {
            checkListItemContent: item.content,
            evaluation: null,
            comment: null,
            errorMessage: normalizedError.message,
          };
          errorResults.push(errorResult);
        }
      }

      // DB保存コールバックが設定されていれば保存
      if (reviewTargetId && onReviewResultSaved) {
        try {
          await onReviewResultSaved(errorResults, reviewTargetId);
        } catch {
          // DB保存エラーは無視（エラー結果は返す）
        }
      }

      // チャンクエラーでもworkflow全体は成功にするためstatus: "success"を返す
      // 個別チェック項目のエラーはerrorMessageに記録されている
      return {
        status: "success",
        reviewResults: errorResults,
      };
    }
  },
});
