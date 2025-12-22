import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { baseStepOutputSchema } from "../../schema";
import { extractedFileSchema } from "../../shared";
import {
  checkListItemSchema,
  evaluationCriterionSchema,
  ReviewExecutionWorkflowRuntimeContext,
  SingleReviewResult,
  singleReviewResultSchema,
} from "../types";
import {
  individualDocumentReviewStep,
  individualDocumentReviewInputSchema,
  individualDocumentReviewOutputSchema,
  type IndividualDocumentReviewResult,
} from "../steps/individualDocumentReviewStep";
import {
  consolidateReviewStep,
  groupReviewResultsByDocument,
} from "../steps/consolidateReviewStep";
import { makeChunksByCount, DEFAULT_CHUNK_OVERLAP } from "../../../lib/util";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { formatMessage } from "@/lib/server/messages";

/**
 * 大量ドキュメントレビューワークフローの入力スキーマ
 */
export const largeDocumentReviewInputSchema = z.object({
  /** 抽出済みファイル配列 */
  files: z.array(extractedFileSchema),
  /** チェック項目一覧 */
  checkListItems: z.array(checkListItemSchema),
  /** 追加指示（オプション） */
  additionalInstructions: z.string().nullable().optional(),
  /** コメントフォーマット（オプション） */
  commentFormat: z.string().nullable().optional(),
  /** 評価基準（オプション） */
  evaluationCriteria: z.array(evaluationCriterionSchema).optional(),
});

export type LargeDocumentReviewInput = z.infer<
  typeof largeDocumentReviewInputSchema
>;

/**
 * 大量ドキュメントレビューワークフローの出力スキーマ
 */
export const largeDocumentReviewOutputSchema = baseStepOutputSchema.extend({
  /** レビュー結果 */
  reviewResults: z.array(singleReviewResultSchema).optional(),
});

export type LargeDocumentReviewOutput = z.infer<
  typeof largeDocumentReviewOutputSchema
>;

/**
 * 個別ドキュメントレビューリトライワークフローの入力スキーマ
 * dountilでコンテキスト長エラー時の分割リトライを管理する
 */
const individualDocumentReviewRetryInputSchema = z.object({
  /** 元のドキュメント（分割元） */
  originalFile: extractedFileSchema,
  /** レビュー入力配列（分割後は複数になる） */
  reviewInputs: z.array(individualDocumentReviewInputSchema),
  /** リトライ回数 */
  retryCount: z.number(),
  /** 終了理由 */
  finishReason: z.enum(["success", "error", "content_length"]),
  /** ステータス */
  status: z.enum(["success", "failed"]),
  /** エラーメッセージ */
  errorMessage: z.string().optional(),
  /** レビュー結果（成功時） */
  reviewResults: z
    .array(
      z.object({
        documentId: z.string(),
        documentName: z.string(),
        checklistId: z.string(),
        comment: z.string(),
      }),
    )
    .optional(),
});

type IndividualDocumentReviewRetryInput = z.infer<
  typeof individualDocumentReviewRetryInputSchema
>;

/**
 * 個別ドキュメントレビューワークフローの出力スキーマ
 */
const individualDocumentReviewWorkflowOutputSchema =
  baseStepOutputSchema.extend({
    /** 元のファイル名 */
    originalFileName: z.string(),
    /** レビュー結果 */
    reviewResults: z
      .array(
        z.object({
          documentId: z.string(),
          documentName: z.string(),
          checklistId: z.string(),
          comment: z.string(),
        }),
      )
      .optional(),
  });

type IndividualDocumentReviewWorkflowOutput = z.infer<
  typeof individualDocumentReviewWorkflowOutputSchema
>;

/**
 * 最大リトライ回数（分割回数）
 */
const MAX_SPLIT_RETRY_COUNT = 5;

/**
 * 個別ドキュメントレビューワークフロー
 * 個別ドキュメントレビューを実行し、コンテキスト長エラーになった時のみ分割してリトライする
 */
const individualDocumentReviewWorkflow = createWorkflow({
  id: "individual-document-review-workflow",
  inputSchema: individualDocumentReviewInputSchema,
  outputSchema: individualDocumentReviewWorkflowOutputSchema,
})
  .map(async ({ inputData }) => {
    // dountil用の初期状態を作成
    return {
      originalFile: inputData.file,
      reviewInputs: [inputData],
      retryCount: 0,
      finishReason: "error" as const,
      status: "failed" as const,
    } as IndividualDocumentReviewRetryInput;
  })
  .dountil(
    // リトライワークフロー
    createWorkflow({
      id: "individual-document-review-retry-workflow",
      inputSchema: individualDocumentReviewRetryInputSchema,
      outputSchema: individualDocumentReviewRetryInputSchema,
    })
      .map(async ({ inputData }) => {
        // foreach用の配列を返す
        return inputData.reviewInputs;
      })
      .foreach(individualDocumentReviewStep, { concurrency: 5 })
      .map(async ({ inputData, getInitData }) => {
        const initData =
          (await getInitData()) as IndividualDocumentReviewRetryInput;
        const nextRetryCount = initData.retryCount + 1;

        // 全て成功している場合
        if (inputData.every((item) => item.status === "success")) {
          return {
            originalFile: initData.originalFile,
            reviewInputs: initData.reviewInputs,
            retryCount: nextRetryCount,
            finishReason: "success" as const,
            status: "success" as const,
            reviewResults: inputData.flatMap(
              (item) => item.reviewResults || [],
            ),
          } as IndividualDocumentReviewRetryInput;
        }

        // コンテキスト長エラーかどうかを判定
        const hasContentLengthError = inputData.some(
          (item) =>
            item.status === "failed" && item.finishReason === "content_length",
        );

        if (!hasContentLengthError) {
          // コンテキスト長エラー以外の失敗
          const errorItem = inputData.find((item) => item.status === "failed");
          return {
            originalFile: initData.originalFile,
            reviewInputs: initData.reviewInputs,
            retryCount: nextRetryCount,
            finishReason: "error" as const,
            status: "failed" as const,
            errorMessage:
              errorItem?.errorMessage ||
              formatMessage("REVIEW_UNEXPECTED_ERROR"),
            reviewResults: inputData.flatMap(
              (item) => item.reviewResults || [],
            ),
          } as IndividualDocumentReviewRetryInput;
        }

        // リトライ回数が上限に達した場合
        if (initData.retryCount >= MAX_SPLIT_RETRY_COUNT) {
          return {
            originalFile: initData.originalFile,
            reviewInputs: initData.reviewInputs,
            retryCount: nextRetryCount,
            finishReason: "error" as const,
            status: "failed" as const,
            errorMessage: formatMessage("REVIEW_SPLIT_RETRY_EXCEEDED"),
            reviewResults: inputData.flatMap(
              (item) => item.reviewResults || [],
            ),
          } as IndividualDocumentReviewRetryInput;
        }

        // ドキュメントを分割してリトライ
        const splitCount = nextRetryCount + 1;
        const originalFile = initData.originalFile;
        const baseInput = initData.reviewInputs[0];

        if (originalFile.textContent) {
          // テキストドキュメントの分割
          const text = originalFile.textContent;
          const ranges = makeChunksByCount(
            text,
            splitCount,
            DEFAULT_CHUNK_OVERLAP.TEXT_CHARS,
          );

          const newReviewInputs = ranges.map(({ start, end }, index) => ({
            ...baseInput,
            file: {
              ...originalFile,
              id: `${originalFile.id}_part${index + 1}`,
              name: `${originalFile.name} (part ${index + 1})`,
              originalName: originalFile.name,
              textContent: text.slice(start, end),
              totalChunks: splitCount,
              chunkIndex: index,
            },
          }));

          return {
            originalFile: initData.originalFile,
            reviewInputs: newReviewInputs,
            retryCount: nextRetryCount,
            finishReason: "content_length" as const,
            status: "success" as const,
          } as IndividualDocumentReviewRetryInput;
        } else if (
          originalFile.imageData &&
          originalFile.imageData.length > 0
        ) {
          // 画像ドキュメントの分割
          const imageData = originalFile.imageData;
          const ranges = makeChunksByCount(
            imageData,
            splitCount,
            DEFAULT_CHUNK_OVERLAP.IMAGE_COUNT,
          );

          const newReviewInputs = ranges.map(({ start, end }, index) => ({
            ...baseInput,
            file: {
              ...originalFile,
              id: `${originalFile.id}_part${index + 1}`,
              name: `${originalFile.name} (part ${index + 1})`,
              originalName: originalFile.name,
              imageData: imageData.slice(start, end),
              totalChunks: splitCount,
              chunkIndex: index,
            },
          }));

          return {
            originalFile: initData.originalFile,
            reviewInputs: newReviewInputs,
            retryCount: nextRetryCount,
            finishReason: "content_length" as const,
            status: "success" as const,
          } as IndividualDocumentReviewRetryInput;
        }

        // ここには到達しないはず
        return {
          originalFile: initData.originalFile,
          reviewInputs: [],
          retryCount: nextRetryCount,
          finishReason: "error" as const,
          status: "failed" as const,
          errorMessage: formatMessage("REVIEW_UNEXPECTED_NO_DATA"),
        } as IndividualDocumentReviewRetryInput;
      })
      .commit(),
    // 終了条件
    async ({ inputData }) => {
      // リトライ回数上限
      if (inputData.retryCount >= MAX_SPLIT_RETRY_COUNT + 1) {
        return true;
      }
      // コンテキスト長エラー以外で終了
      if (inputData.finishReason !== "content_length") {
        return true;
      }
      return false;
    },
  )
  .map(async ({ inputData }) => {
    // 最終結果を整形
    if (inputData.status === "failed") {
      return {
        status: "failed" as const,
        originalFileName: inputData.originalFile.name,
        errorMessage: inputData.errorMessage,
      } as IndividualDocumentReviewWorkflowOutput;
    }

    return {
      status: "success" as const,
      originalFileName: inputData.originalFile.name,
      reviewResults: inputData.reviewResults,
    } as IndividualDocumentReviewWorkflowOutput;
  })
  .commit();

/**
 * 大量ドキュメントレビューワークフロー
 * 個別ドキュメントレビュー（並列実行） → レビュー結果統合の流れ
 */
export const largeDocumentReviewWorkflow = createWorkflow({
  id: "large-document-review-workflow",
  inputSchema: largeDocumentReviewInputSchema,
  outputSchema: largeDocumentReviewOutputSchema,
})
  .map(async ({ inputData }) => {
    // 各ファイルに対する個別レビュー入力を作成
    return inputData.files.map((file) => ({
      file: {
        ...file,
        originalName: file.name,
        totalChunks: 1,
        chunkIndex: 0,
      },
      checkListItems: inputData.checkListItems,
      additionalInstructions: inputData.additionalInstructions,
      commentFormat: inputData.commentFormat,
    }));
  })
  .foreach(individualDocumentReviewWorkflow, { concurrency: 5 })
  .map(async ({ inputData, bail, getInitData, runtimeContext }) => {
    const initData = (await getInitData()) as LargeDocumentReviewInput;
    // workflowのRuntimeContextから各種設定を取得
    const typedWorkflowRuntimeContext = runtimeContext as
      | RuntimeContext<ReviewExecutionWorkflowRuntimeContext>
      | undefined;
    const reviewTargetId = typedWorkflowRuntimeContext?.get("reviewTargetId");
    const onReviewResultSaved = typedWorkflowRuntimeContext?.get(
      "onReviewResultSaved",
    );

    // どれかの個別レビューが失敗していた場合
    const failedItem = inputData.find((item) => item.status === "failed");
    if (failedItem) {
      // チェック項目全てにエラー結果を作成
      const errorResults: SingleReviewResult[] = initData.checkListItems.map(
        (item) => ({
          checkListItemContent: item.content,
          evaluation: null,
          comment: null,
          errorMessage:
            failedItem.errorMessage || formatMessage("REVIEW_UNKNOWN_ERROR"),
        }),
      );

      // DB保存コールバックが設定されていれば保存
      if (reviewTargetId && onReviewResultSaved) {
        try {
          await onReviewResultSaved(errorResults, reviewTargetId);
        } catch {
          // DB保存エラーは無視（エラー結果は返す）
        }
      }
      return bail({
        status: "failed" as const,
        errorMessage:
          failedItem.errorMessage ||
          formatMessage("REVIEW_INDIVIDUAL_DOC_REVIEW_FAILED"),
      });
    }

    // 全ての個別レビュー結果を収集
    const allReviewResults: IndividualDocumentReviewResult[] = [];
    for (const item of inputData) {
      if (item.reviewResults) {
        // originalFileNameを使ってoriginalNameを復元
        const results = item.reviewResults.map((r) => ({
          ...r,
          originalName: item.originalFileName,
        }));
        allReviewResults.push(...(results as IndividualDocumentReviewResult[]));
      }
    }

    // 統合ステップ用のデータを準備
    // 注意: 個別結果のDB保存はconsolidateReviewStep内で実行（レビュー結果保存後に実行する必要があるため）
    const documentsWithReviewResults =
      groupReviewResultsByDocument(allReviewResults);

    // OriginalNameを復元
    for (const doc of documentsWithReviewResults) {
      // originalFileNameをマッチングして設定
      const matchingItem = inputData.find((item) =>
        item.reviewResults?.some((r) => r.documentId === doc.documentId),
      );
      if (matchingItem) {
        doc.originalName = matchingItem.originalFileName;
      }
    }

    return {
      documentsWithReviewResults,
      checkListItems: initData.checkListItems,
      additionalInstructions: initData.additionalInstructions,
      commentFormat: initData.commentFormat,
      evaluationCriteria: initData.evaluationCriteria,
    };
  })
  .then(consolidateReviewStep)
  .map(async ({ inputData }) => {
    // 統合ステップの結果をそのまま返す
    return {
      status: inputData.status,
      errorMessage: inputData.errorMessage,
      reviewResults: inputData.reviewResults,
    } as LargeDocumentReviewOutput;
  })
  .commit();
