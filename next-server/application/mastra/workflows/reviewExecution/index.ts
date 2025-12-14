import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { baseStepOutputSchema } from "../schema";
import {
  triggerSchema,
  singleReviewResultSchema,
  checkListItemSchema,
  evaluationCriterionSchema,
} from "./types";
import {
  smallDocumentReviewStep,
  smallDocumentReviewOutputSchema,
} from "./steps/smallDocumentReviewStep";
import { classifyChecklistStep } from "./steps/classifyChecklistStep";
import { fileProcessingStep, extractedFileSchema } from "../shared";

/**
 * レビュー実行ワークフローの出力スキーマ
 */
export const reviewExecutionOutputSchema = baseStepOutputSchema.extend({
  reviewResults: z.array(singleReviewResultSchema).optional(),
});

export type ReviewExecutionOutput = z.infer<typeof reviewExecutionOutputSchema>;

/**
 * チャンクレビュー用の入力スキーマ
 * foreachで各チャンクをレビューするために使用
 */
const chunkReviewInputSchema = z.object({
  files: z.array(extractedFileSchema),
  checkListItems: z.array(checkListItemSchema),
  additionalInstructions: z.string().nullable().optional(),
  commentFormat: z.string().nullable().optional(),
  evaluationCriteria: z.array(evaluationCriterionSchema).optional(),
});

/**
 * チャンクごとのレビューワークフロー
 * foreachで各チャンクを処理するために使用
 */
const chunkReviewWorkflow = createWorkflow({
  id: "chunk-review-workflow",
  inputSchema: chunkReviewInputSchema,
  outputSchema: smallDocumentReviewOutputSchema,
})
  .then(smallDocumentReviewStep)
  .commit();

/**
 * レビュー実行ワークフロー
 * ドキュメントをチェック項目に基づいてAIレビューする
 *
 * フロー:
 * 1. fileProcessingStep: バイナリファイルからテキスト抽出/画像Base64変換
 * 2. classifyChecklistStep: チェックリストを分類・分割
 * 3. foreach(chunkReviewWorkflow): チャンクごとにAIレビューを実行
 * 4. .map(): 結果を統合して最終出力形式に変換
 */
export const reviewExecutionWorkflow = createWorkflow({
  id: "review-execution-workflow",
  inputSchema: triggerSchema,
  outputSchema: reviewExecutionOutputSchema,
})
  .map(async ({ inputData }) => {
    // fileProcessingStepの入力形式に変換
    return {
      files: inputData.files,
    };
  })
  .then(fileProcessingStep)
  .map(async ({ inputData, bail, getInitData }) => {
    // ファイル処理が失敗した場合は、bailで早期終了
    if (inputData.status === "failed") {
      return bail({
        status: "failed" as const,
        errorMessage: inputData.errorMessage || "ファイル処理に失敗しました",
      });
    }

    // 抽出されたファイルが空の場合
    if (!inputData.extractedFiles || inputData.extractedFiles.length === 0) {
      return bail({
        status: "failed" as const,
        errorMessage: "ファイルを処理できませんでした",
      });
    }

    // 元のトリガー入力からチェック項目とレビュー設定を取得
    const initialInput = getInitData();

    // classifyChecklistStepの入力形式に変換
    return {
      checkListItems: initialInput.checkListItems,
      concurrentReviewItems:
        initialInput.reviewSettings?.concurrentReviewItems ?? undefined,
      // 後続のmapで使用するためにfileProcessingStepの結果を保持
      _extractedFiles: inputData.extractedFiles,
      _reviewSettings: initialInput.reviewSettings,
    };
  })
  .then(classifyChecklistStep)
  .map(async ({ inputData, bail, getStepResult, getInitData }) => {
    // チェックリスト分類が失敗した場合
    if (inputData.status === "failed") {
      return bail({
        status: "failed" as const,
        errorMessage: inputData.errorMessage || "チェックリスト分類に失敗しました",
      });
    }

    const chunks = inputData.chunks ?? [];
    if (chunks.length === 0) {
      return bail({
        status: "failed" as const,
        errorMessage: "チェック項目がありません",
      });
    }

    // fileProcessingStepの結果を取得
    const fileProcessingResult = getStepResult(fileProcessingStep);
    const initialInput = getInitData();

    // foreach用の配列を作成（各チャンクにファイル情報とレビュー設定を付加）
    return chunks.map((chunk) => ({
      files: fileProcessingResult?.extractedFiles ?? [],
      checkListItems: chunk,
      additionalInstructions:
        initialInput.reviewSettings?.additionalInstructions ?? null,
      commentFormat: initialInput.reviewSettings?.commentFormat ?? null,
      evaluationCriteria:
        initialInput.reviewSettings?.evaluationCriteria ?? undefined,
    }));
  })
  .foreach(chunkReviewWorkflow)
  .map(async ({ inputData }) => {
    // foreachの結果は配列（各チャンクのレビュー結果）
    const allResults: z.infer<typeof singleReviewResultSchema>[] = [];
    let hasError = false;
    let lastErrorMessage: string | undefined;

    for (const chunkResult of inputData) {
      if (chunkResult.reviewResults) {
        allResults.push(...chunkResult.reviewResults);
      }
      if (chunkResult.status === "failed") {
        hasError = true;
        lastErrorMessage = chunkResult.errorMessage;
      }
    }

    // 全て失敗した場合
    if (allResults.length === 0 || allResults.every((r) => r.errorMessage !== null)) {
      return {
        status: "failed" as const,
        errorMessage: lastErrorMessage || "全てのチェック項目のレビューに失敗しました",
        reviewResults: allResults,
      };
    }

    return {
      status: hasError ? ("failed" as const) : ("success" as const),
      errorMessage: hasError ? lastErrorMessage : undefined,
      reviewResults: allResults,
    };
  })
  .commit();

// 型とスキーマを再エクスポート
export { triggerSchema } from "./types";
export type {
  TriggerInput,
  CheckListItem,
  EvaluationCriterion,
  ReviewSettingsInput,
  SingleReviewResult,
  ReviewExecutionWorkflowRuntimeContext,
} from "./types";

// shared typesも再エクスポート（ワークフロー利用者の便宜のため）
export {
  rawUploadFileMetaSchema,
  extractedFileSchema,
  FILE_BUFFERS_CONTEXT_KEY,
  type RawUploadFileMeta,
  type ExtractedFile,
  type FileBufferData,
  type FileBuffersMap,
} from "../shared";

// stepsのエクスポート
export { classifyChecklistStep } from "./steps/classifyChecklistStep";
export type {
  ClassifyChecklistInput,
  ClassifyChecklistOutput,
} from "./steps/classifyChecklistStep";
export { smallDocumentReviewStep } from "./steps/smallDocumentReviewStep";
export type {
  SmallDocumentReviewInput,
  SmallDocumentReviewOutput,
} from "./steps/smallDocumentReviewStep";
