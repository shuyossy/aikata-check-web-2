import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { baseStepOutputSchema } from "../schema";
import {
  triggerSchema,
  singleReviewResultSchema,
  checkListItemSchema,
  evaluationCriterionSchema,
  reviewTypeSchema,
  type ReviewExecutionWorkflowRuntimeContext,
  type CachedDocument,
} from "./types";
import {
  smallDocumentReviewStep,
  smallDocumentReviewOutputSchema,
} from "./steps/smallDocumentReviewStep";
import {
  classifyChecklistStep,
  classifyChecklistOutputSchema,
} from "./steps/classifyChecklistStep";
import { fileProcessingStep, extractedFileSchema, type ExtractedFile } from "../shared";
import {
  largeDocumentReviewWorkflow,
  largeDocumentReviewOutputSchema,
} from "./largeDocumentReview";

/**
 * レビュー実行ワークフローの出力スキーマ
 */
export const reviewExecutionOutputSchema = baseStepOutputSchema.extend({
  reviewResults: z.array(singleReviewResultSchema).optional(),
});

export type ReviewExecutionOutput = z.infer<typeof reviewExecutionOutputSchema>;

/**
 * チャンクレビュー用の入力スキーマ
 * foreachで各チャンクをレビューするために使用（少量/大量共通）
 */
const chunkReviewInputSchema = z.object({
  reviewType: reviewTypeSchema,
  files: z.array(extractedFileSchema),
  checkListItems: z.array(checkListItemSchema),
  additionalInstructions: z.string().nullable().optional(),
  commentFormat: z.string().nullable().optional(),
  evaluationCriteria: z.array(evaluationCriterionSchema).optional(),
});

/**
 * チャンクレビュー結果の統一スキーマ
 */
const chunkReviewOutputSchema = baseStepOutputSchema.extend({
  reviewResults: z.array(singleReviewResultSchema).optional(),
});

/**
 * チャンクごとのレビューワークフロー
 * small/large両方に対応
 */
const chunkReviewWorkflow = createWorkflow({
  id: "chunk-review-workflow",
  inputSchema: chunkReviewInputSchema,
  outputSchema: chunkReviewOutputSchema,
})
  .branch([
    // 少量レビュー: smallDocumentReviewStepを直接使用
    [
      async ({ inputData }) => inputData.reviewType === "small",
      createWorkflow({
        id: "small-chunk-review-workflow",
        inputSchema: chunkReviewInputSchema,
        outputSchema: smallDocumentReviewOutputSchema,
      })
        .then(smallDocumentReviewStep)
        .commit(),
    ],
    // 大量レビュー: largeDocumentReviewWorkflowを使用
    [
      async ({ inputData }) => inputData.reviewType === "large",
      createWorkflow({
        id: "large-chunk-review-workflow",
        inputSchema: chunkReviewInputSchema,
        outputSchema: largeDocumentReviewOutputSchema,
      })
        .map(async ({ inputData }) => {
          // largeDocumentReviewWorkflowの入力形式に変換
          return {
            files: inputData.files,
            checkListItems: inputData.checkListItems,
            additionalInstructions: inputData.additionalInstructions,
            commentFormat: inputData.commentFormat,
            evaluationCriteria: inputData.evaluationCriteria,
          };
        })
        .then(largeDocumentReviewWorkflow)
        .commit(),
    ],
  ])
  .map(async ({ inputData }) => {
    // branchの結果を統一フォーマットで返す
    const result =
      (inputData as Record<string, z.infer<typeof chunkReviewOutputSchema>>)[
        "small-chunk-review-workflow"
      ] ||
      (inputData as Record<string, z.infer<typeof chunkReviewOutputSchema>>)[
        "large-chunk-review-workflow"
      ];
    return {
      status: result.status,
      errorMessage: result.errorMessage,
      reviewResults: result.reviewResults,
    } as z.infer<typeof chunkReviewOutputSchema>;
  })
  .commit();

/**
 * キャッシュされたドキュメントをExtractedFile形式に変換する
 */
function convertCachedDocumentsToExtractedFiles(
  cachedDocuments: CachedDocument[],
): ExtractedFile[] {
  return cachedDocuments.map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    processMode: doc.processMode,
    textContent: doc.textContent,
    imageData: doc.imageData,
  }));
}

/**
 * レビュー実行ワークフロー
 * ドキュメントをチェック項目に基づいてAIレビューする
 *
 * フロー:
 * 1. parallel: ファイル処理とチェックリスト分類を並列実行（少量/大量共通）
 *    - fileProcessingStep: バイナリファイルからテキスト抽出/画像Base64変換
 *      ※リトライ時（useCachedDocuments=true）の場合はスキップし、キャッシュを使用
 *    - classifyChecklistStep: チェックリストを分類・分割
 * 2. foreach: 各チェックリストチャンクに対して
 *    - branch: reviewTypeに基づいて分岐
 *      - small: smallDocumentReviewStep
 *      - large: largeDocumentReviewWorkflow
 * 3. 全チャンクの結果を統合
 */
/**
 * キャッシュモード判定ステップ
 * RuntimeContextからキャッシュモードかどうかを判定し、キャッシュモードの場合は
 * キャッシュデータをExtractedFilesに変換して返す
 * 通常モードの場合は、ファイル処理用の入力形式に変換する
 */
const cacheCheckStep = createStep({
  id: "cache-check",
  inputSchema: triggerSchema,
  outputSchema: z.object({
    useCacheMode: z.boolean(),
    // キャッシュモードの場合の結果
    cacheResult: baseStepOutputSchema.extend({
      extractedFiles: z.array(extractedFileSchema).optional(),
    }).optional(),
    // 通常モードの場合のファイル入力
    files: z.array(z.any()).optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    // RuntimeContextからキャッシュ設定を取得
    const useCachedDocuments = runtimeContext.get("useCachedDocuments") as
      | ReviewExecutionWorkflowRuntimeContext["useCachedDocuments"]
      | undefined;
    const cachedDocuments = runtimeContext.get("cachedDocuments") as
      | ReviewExecutionWorkflowRuntimeContext["cachedDocuments"]
      | undefined;

    // キャッシュモードの場合はキャッシュからExtractedFilesを生成
    if (useCachedDocuments && cachedDocuments && cachedDocuments.length > 0) {
      const extractedFiles = convertCachedDocumentsToExtractedFiles(cachedDocuments);
      return {
        useCacheMode: true,
        cacheResult: {
          status: "success" as const,
          extractedFiles,
        },
      };
    }

    // 通常モード: fileProcessingStepへ渡す
    return {
      useCacheMode: false,
      files: inputData.files,
    };
  },
});

export const reviewExecutionWorkflow = createWorkflow({
  id: "review-execution-workflow",
  inputSchema: triggerSchema,
  outputSchema: reviewExecutionOutputSchema,
})
  // Step 1: ファイル処理とチェックリスト分類を並列実行
  .parallel([
    // ファイル処理（リトライ時はキャッシュを使用）
    createWorkflow({
      id: "file-processing",
      inputSchema: triggerSchema,
      outputSchema: baseStepOutputSchema.extend({
        extractedFiles: z.array(extractedFileSchema).optional(),
      }),
    })
      .then(cacheCheckStep)
      .branch([
        // キャッシュモード: キャッシュ結果をそのまま返す
        [
          async ({ inputData }) => (inputData as { useCacheMode?: boolean }).useCacheMode === true,
          createWorkflow({
            id: "use-cache-result",
            inputSchema: z.object({
              useCacheMode: z.boolean(),
              cacheResult: baseStepOutputSchema.extend({
                extractedFiles: z.array(extractedFileSchema).optional(),
              }).optional(),
              files: z.array(z.any()).optional(),
            }),
            outputSchema: baseStepOutputSchema.extend({
              extractedFiles: z.array(extractedFileSchema).optional(),
            }),
          })
            .map(async ({ inputData }) => ({
              status: inputData.cacheResult?.status ?? "failed",
              extractedFiles: inputData.cacheResult?.extractedFiles,
            }))
            .commit(),
        ],
        // 通常モード: ファイル処理を実行
        [
          async ({ inputData }) => (inputData as { useCacheMode?: boolean }).useCacheMode === false,
          createWorkflow({
            id: "normal-file-processing",
            inputSchema: z.object({
              useCacheMode: z.boolean(),
              cacheResult: baseStepOutputSchema.extend({
                extractedFiles: z.array(extractedFileSchema).optional(),
              }).optional(),
              files: z.array(z.any()).optional(),
            }),
            outputSchema: baseStepOutputSchema.extend({
              extractedFiles: z.array(extractedFileSchema).optional(),
            }),
          })
            .map(async ({ inputData }) => ({ files: inputData.files ?? [] }))
            .then(fileProcessingStep)
            .commit(),
        ],
      ])
      .map(async ({ inputData }) => {
        // branchの結果を取得
        const cacheResult = inputData["use-cache-result"];
        const normalResult = inputData["normal-file-processing"];

        const result = cacheResult || normalResult;
        return {
          status: result?.status ?? "failed",
          extractedFiles: result?.extractedFiles,
          errorMessage: (result as { errorMessage?: string } | undefined)?.errorMessage,
        };
      })
      .commit(),
    // チェックリスト分類
    createWorkflow({
      id: "checklist-classification",
      inputSchema: triggerSchema,
      outputSchema: classifyChecklistOutputSchema,
    })
      .map(async ({ inputData }) => {
        return {
          checkListItems: inputData.checkListItems,
          concurrentReviewItems:
            inputData.reviewSettings?.concurrentReviewItems ?? undefined,
        };
      })
      .then(classifyChecklistStep)
      .commit(),
  ])
  // Step 2: 並列処理の結果を統合してforeach用の配列を作成
  .map(async ({ inputData, bail, getInitData, runtimeContext }) => {
    const fileProcessingResult = inputData["file-processing"];
    const classificationResult = inputData["checklist-classification"];

    // ファイル処理が失敗した場合
    if (fileProcessingResult.status === "failed") {
      return bail({
        status: "failed" as const,
        errorMessage:
          fileProcessingResult.errorMessage || "ファイル処理に失敗しました",
      });
    }

    // 抽出されたファイルが空の場合
    if (
      !fileProcessingResult.extractedFiles ||
      fileProcessingResult.extractedFiles.length === 0
    ) {
      return bail({
        status: "failed" as const,
        errorMessage: "ファイルを処理できませんでした",
      });
    }

    // 通常モード（初回レビュー）時のみ、抽出済みファイルをキャッシュ保存
    // リトライ時（useCachedDocuments=true）はスキップ
    const useCachedDocuments = runtimeContext.get("useCachedDocuments") as
      | ReviewExecutionWorkflowRuntimeContext["useCachedDocuments"]
      | undefined;
    if (!useCachedDocuments) {
      const onExtractedFilesCached = runtimeContext.get("onExtractedFilesCached") as
        | ReviewExecutionWorkflowRuntimeContext["onExtractedFilesCached"]
        | undefined;
      const reviewTargetId = runtimeContext.get("reviewTargetId") as
        | ReviewExecutionWorkflowRuntimeContext["reviewTargetId"]
        | undefined;
      if (onExtractedFilesCached && reviewTargetId) {
        await onExtractedFilesCached(
          fileProcessingResult.extractedFiles,
          reviewTargetId,
        );
      }
    }

    // チェックリスト分類が失敗した場合
    if (classificationResult.status === "failed") {
      return bail({
        status: "failed" as const,
        errorMessage:
          classificationResult.errorMessage ||
          "チェックリスト分類に失敗しました",
      });
    }

    const chunks = classificationResult.chunks ?? [];
    if (chunks.length === 0) {
      return bail({
        status: "failed" as const,
        errorMessage: "チェック項目がありません",
      });
    }

    // 元のトリガー入力を取得
    const initialInput = getInitData();
    const reviewType = initialInput.reviewType ?? "small";
    const reviewSettings = initialInput.reviewSettings;

    // foreach用の配列を作成（各チャンクにファイル情報とレビュー設定を付加）
    return chunks.map((chunk) => ({
      reviewType: reviewType as "small" | "large",
      files: fileProcessingResult.extractedFiles!,
      checkListItems: chunk,
      additionalInstructions: reviewSettings?.additionalInstructions ?? null,
      commentFormat: reviewSettings?.commentFormat ?? null,
      evaluationCriteria: reviewSettings?.evaluationCriteria ?? undefined,
    }));
  })
  // Step 3: 各チャンクをレビュー
  .foreach(chunkReviewWorkflow, { concurrency: 2 })
  // Step 4: 全チャンクの結果を統合
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
    if (
      allResults.length === 0 ||
      allResults.every((r) => r.errorMessage !== null)
    ) {
      return {
        status: "failed" as const,
        errorMessage:
          lastErrorMessage || "全てのチェック項目のレビューに失敗しました",
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
export { triggerSchema, reviewTypeSchema } from "./types";
export type {
  TriggerInput,
  CheckListItem,
  EvaluationCriterion,
  ReviewSettingsInput,
  SingleReviewResult,
  ReviewExecutionWorkflowRuntimeContext,
  ReviewType,
  CachedDocument,
  OnExtractedFilesCachedCallback,
  IndividualDocumentResult,
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
export { individualDocumentReviewStep } from "./steps/individualDocumentReviewStep";
export type {
  IndividualDocumentReviewInput,
  IndividualDocumentReviewOutput,
  IndividualDocumentReviewResult,
} from "./steps/individualDocumentReviewStep";
export { consolidateReviewStep } from "./steps/consolidateReviewStep";
export type {
  ConsolidateReviewInput,
  ConsolidateReviewOutput,
} from "./steps/consolidateReviewStep";

// largeDocumentReviewWorkflowのエクスポート
export { largeDocumentReviewWorkflow } from "./largeDocumentReview";
export type {
  LargeDocumentReviewInput,
  LargeDocumentReviewOutput,
} from "./largeDocumentReview";
