import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RuntimeContext } from "@mastra/core/di";
import { consolidateReviewAgent } from "../../../agents";
import { baseStepOutputSchema } from "../../schema";
import {
  createRuntimeContext,
  judgeFinishReason,
} from "../../../lib/agentUtils";
import { normalizeUnknownError, workflowError } from "@/lib/server/error";
import { formatMessage } from "@/lib/server/messages";
import type { ConsolidateReviewAgentRuntimeContext } from "../../../agents";
import {
  checkListItemSchema,
  evaluationCriterionSchema,
  singleReviewResultSchema,
  type ReviewExecutionWorkflowRuntimeContext,
  type SingleReviewResult,
  type IndividualDocumentResult,
} from "../types";
import type { IndividualDocumentReviewResult } from "./individualDocumentReviewStep";

/**
 * 個別レビュー結果付きドキュメントのスキーマ
 */
export const documentWithReviewResultsSchema = z.object({
  /** ドキュメントID */
  documentId: z.string(),
  /** ドキュメント名 */
  documentName: z.string(),
  /** 元のファイル名（分割時に使用） */
  originalName: z.string().optional(),
  /** レビュー結果配列 */
  reviewResults: z.array(
    z.object({
      checklistId: z.string(),
      comment: z.string(),
    }),
  ),
});

export type DocumentWithReviewResults = z.infer<
  typeof documentWithReviewResultsSchema
>;

/**
 * レビュー結果統合ステップの入力スキーマ
 */
export const consolidateReviewInputSchema = z.object({
  /** 個別レビュー結果付きドキュメント配列 */
  documentsWithReviewResults: z.array(documentWithReviewResultsSchema),
  /** チェック項目一覧 */
  checkListItems: z.array(checkListItemSchema),
  /** 追加指示（オプション） */
  additionalInstructions: z.string().nullable().optional(),
  /** コメントフォーマット（オプション） */
  commentFormat: z.string().nullable().optional(),
  /** 評価基準（オプション） */
  evaluationCriteria: z.array(evaluationCriterionSchema).optional(),
});

/**
 * レビュー結果統合ステップの出力スキーマ
 */
export const consolidateReviewOutputSchema = baseStepOutputSchema.extend({
  /** 統合されたレビュー結果 */
  reviewResults: z.array(singleReviewResultSchema).optional(),
});

export type ConsolidateReviewInput = z.infer<
  typeof consolidateReviewInputSchema
>;
export type ConsolidateReviewOutput = z.infer<
  typeof consolidateReviewOutputSchema
>;

/**
 * 最大リトライ回数
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * 個別レビュー結果をドキュメント別にグループ化する関数
 */
export function groupReviewResultsByDocument(
  results: IndividualDocumentReviewResult[],
): DocumentWithReviewResults[] {
  const documentMap = new Map<string, DocumentWithReviewResults>();

  for (const result of results) {
    const existing = documentMap.get(result.documentId);
    if (existing) {
      existing.reviewResults.push({
        checklistId: result.checklistId,
        comment: result.comment,
      });
    } else {
      documentMap.set(result.documentId, {
        documentId: result.documentId,
        documentName: result.documentName,
        originalName: result.documentName, // デフォルトはドキュメント名と同じ
        reviewResults: [
          {
            checklistId: result.checklistId,
            comment: result.comment,
          },
        ],
      });
    }
  }

  return Array.from(documentMap.values());
}

/**
 * レビュー結果統合ステップ
 * 個別ドキュメントレビューの結果を統合して最終評価を生成する
 */
export const consolidateReviewStep = createStep({
  id: "consolidate-review",
  description: "個別レビュー結果を統合して最終評価を生成する",
  inputSchema: consolidateReviewInputSchema,
  outputSchema: consolidateReviewOutputSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
  }): Promise<ConsolidateReviewOutput> => {
    const {
      documentsWithReviewResults,
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
    const onIndividualResultsSaved = typedWorkflowRuntimeContext?.get(
      "onIndividualResultsSaved",
    );

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
          comment: z.string().describe("consolidated evaluation comment"),
          evaluation: evaluationEnum.describe("evaluation"),
        }),
      );

      // 結果を格納する配列
      const reviewResults: SingleReviewResult[] = [];
      let targetChecklistItems = [...checkListItems];
      let attempt = 0;

      // 個別レビュー結果を整理
      const consolidatedInput = documentsWithReviewResults.map((docResult) => ({
        originalName: docResult.originalName || docResult.documentName,
        documentName: docResult.documentName,
        reviewResults: docResult.reviewResults,
      }));

      // オリジナルファイル名のユニークセット
      const originalFileNames = [
        ...new Set(consolidatedInput.map((doc) => doc.originalName)),
      ].join(", ");

      // 最大リトライ回数まで統合レビューを繰り返す
      while (attempt < MAX_RETRY_ATTEMPTS && targetChecklistItems.length > 0) {
        // チェックリストIDとショートIDのマッピングを作成
        const idMapping = new Map<number, string>();
        targetChecklistItems.forEach((item, index) => {
          idMapping.set(index + 1, item.id);
        });

        // 統合レビューメッセージを構築
        const consolidationMessage = `Please consolidate the following individual document review results into a comprehensive final review.

## Document Set Information:
Original Files: ${originalFileNames}

## Individual Document Review Results:
${consolidatedInput
  .map((docResult) => {
    const isPartOfSplit = docResult.originalName !== docResult.documentName;
    return `### Document: ${docResult.documentName}${isPartOfSplit ? ` (part of ${docResult.originalName})` : ""}
${docResult.reviewResults
  .map((result) => {
    // ショートIDを取得
    const targetIndex = targetChecklistItems.findIndex(
      (c) => c.id === result.checklistId,
    );
    const shortId = targetIndex >= 0 ? targetIndex + 1 : null;
    const checklistItem = targetChecklistItems.find(
      (c) => c.id === result.checklistId,
    );
    if (!shortId || !checklistItem) return "";
    return `
**Checklist ID ${shortId}**: ${checklistItem.content}
- **Comment**: ${result.comment}`;
  })
  .filter(Boolean)
  .join("\n")}`;
  })
  .join("\n\n")}

## Checklist Items for Consolidation:
${targetChecklistItems.map((item, index) => `- ID: ${index + 1} - ${item.content}`).join("\n")}

Please provide a consolidated review that synthesizes all individual document reviews into a unified assessment for the entire document set.`;

        // エージェント用のRuntimeContextを作成
        const runtimeContext =
          createRuntimeContext<ConsolidateReviewAgentRuntimeContext>({
            checklistItems: targetChecklistItems,
            additionalInstructions: additionalInstructions ?? undefined,
            commentFormat: commentFormat ?? undefined,
            evaluationCriteria: evaluationCriteria ?? undefined,
            employeeId,
            aiApiKey,
            aiApiUrl,
            aiApiModel,
          });

        // エージェントを実行
        const result = await consolidateReviewAgent.generateLegacy(
          {
            role: "user",
            content: [{ type: "text", text: consolidationMessage }],
          },
          {
            output: dynamicOutputSchema,
            runtimeContext,
          },
        );

        // finishReasonを確認
        const { success: finishSuccess } = judgeFinishReason(
          result.finishReason,
        );
        if (!finishSuccess) {
          throw workflowError("WORKFLOW_AI_API_ERROR");
        }

        // 構造化出力を取得
        const output = result.object;

        // 今回の統合レビューで取得した結果を一時的に格納
        const newResults: SingleReviewResult[] = [];

        if (output && Array.isArray(output)) {
          // 既にレビュー済みのチェック項目内容を取得
          const existingContents = new Set(
            reviewResults.map((r) => r.checkListItemContent),
          );

          // レビュー結果を格納（重複は追加しない）
          for (const item of output) {
            // AIの出力にはショートID（1始まり連番）が含まれるので、元のIDに変換
            const originalId = idMapping.get(item.checklistId);
            const targetItem = targetChecklistItems.find(
              (c) => c.id === originalId,
            );
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

          // まだレビューされていないチェック項目を抽出
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

      // リトライ後も統合されなかったチェック項目はエラーとして記録
      const errorResults: SingleReviewResult[] = [];
      for (const item of targetChecklistItems) {
        const errorResult: SingleReviewResult = {
          checkListItemContent: item.content,
          evaluation: null,
          comment: null,
          errorMessage: formatMessage(
            "REVIEW_AI_OUTPUT_MISSING_CHECKLIST_RESULT",
          ),
        };
        reviewResults.push(errorResult);
        errorResults.push(errorResult);
      }

      // エラー結果もDB保存コールバックで保存
      if (errorResults.length > 0 && reviewTargetId && onReviewResultSaved) {
        await onReviewResultSaved(errorResults, reviewTargetId);
      }

      // 大量レビューの個別結果をDB保存（Q&A機能で使用）
      if (
        reviewTargetId &&
        onIndividualResultsSaved &&
        documentsWithReviewResults.length > 0
      ) {
        try {
          // チェックリストIDからチェック項目内容へのマッピングを作成
          const checklistIdToContent = new Map<string, string>();
          checkListItems.forEach((item) => {
            checklistIdToContent.set(item.id, item.content);
          });

          // 個別結果をコールバック用の形式に変換
          const individualResults: IndividualDocumentResult[] = [];
          for (const doc of documentsWithReviewResults) {
            for (const result of doc.reviewResults) {
              const checklistItemContent = checklistIdToContent.get(
                result.checklistId,
              );
              if (checklistItemContent) {
                individualResults.push({
                  documentId: doc.documentId,
                  documentName: doc.originalName || doc.documentName,
                  checklistItemContent,
                  comment: result.comment,
                  totalChunks: 1,
                  chunkIndex: 0,
                });
              }
            }
          }

          if (individualResults.length > 0) {
            await onIndividualResultsSaved(individualResults, reviewTargetId);
          }
        } catch {
          // 個別結果保存エラーは無視（統合処理は継続）
        }
      }

      return {
        status: "success",
        reviewResults,
      };
    } catch (error) {
      // エラーを正規化して統一的に処理
      const normalizedError = normalizeUnknownError(error);

      // 入力チェック項目全てにエラー結果を作成
      const errorResults: SingleReviewResult[] = checkListItems.map((item) => ({
        checkListItemContent: item.content,
        evaluation: null,
        comment: null,
        errorMessage: normalizedError.message,
      }));

      // DB保存コールバックが設定されていれば保存
      if (reviewTargetId && onReviewResultSaved) {
        try {
          await onReviewResultSaved(errorResults, reviewTargetId);
        } catch {
          // DB保存エラーは無視（エラー結果は返す）
        }
      }

      return {
        status: "failed",
        reviewResults: errorResults,
      };
    }
  },
});
