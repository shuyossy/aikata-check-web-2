import { createWorkflow } from "@mastra/core/workflows";
import type { RuntimeContext } from "@mastra/core/di";
import { z } from "zod";
import { baseStepOutputSchema } from "../../schema";
import {
  checklistResultWithIndividualSchema,
  QaExecutionWorkflowRuntimeContext,
} from "../types";
import {
  getTotalChunksStep,
  getTotalChunksStepInputSchema,
} from "../steps/getTotalChunksStep";
import {
  researchChunkStep,
  researchChunkStepInputSchema,
} from "../steps/researchChunkStep";
import {
  splitTextByCount,
  splitImagesByCount,
} from "@/application/mastra/lib/util";
import { ReviewDocumentCacheRepository } from "@/infrastructure/adapter/db/drizzle/repository/ReviewDocumentCacheRepository";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";
import { getLogger } from "@/lib/server/logger";
import type { QaResearchProgressEvent } from "@/application/shared/port/push/QaSseEventTypes";

const logger = getLogger();

/**
 * リトライ付きドキュメント調査ワークフローの入力スキーマ
 */
export const researchDocumentWithRetryInputSchema = z.object({
  /** ドキュメントキャッシュID */
  documentCacheId: z.string(),
  /** 調査内容 */
  researchContent: z.string(),
  /** 調査理由 */
  reasoning: z.string(),
  /** ユーザーの質問 */
  question: z.string(),
  /** チェックリスト結果（個別結果含む） */
  checklistResults: z.array(checklistResultWithIndividualSchema),
});

export type ResearchDocumentWithRetryInput = z.infer<
  typeof researchDocumentWithRetryInputSchema
>;

/**
 * リトライ付きドキュメント調査ワークフローの出力スキーマ
 */
export const researchDocumentWithRetryOutputSchema =
  baseStepOutputSchema.extend({
    /** ドキュメントキャッシュID */
    documentCacheId: z.string().optional(),
    /** ドキュメント名 */
    documentName: z.string().optional(),
    /** 調査内容 */
    researchContent: z.string().optional(),
    /** 調査結果 */
    researchResult: z.string().optional(),
  });

export type ResearchDocumentWithRetryOutput = z.infer<
  typeof researchDocumentWithRetryOutputSchema
>;

/**
 * 内部ワークフローの入力スキーマ（dountil用）
 */
const chunkResearchInnerWorkflowInputSchema = baseStepOutputSchema.extend({
  documentCacheId: z.string(),
  researchContent: z.string(),
  reasoning: z.string(),
  question: z.string(),
  checklistResults: z.array(checklistResultWithIndividualSchema),
  retryCount: z.number(),
  totalChunks: z.number(),
  researchResult: z.string().optional(),
  finishReason: z.enum(["success", "error", "content_length"]),
});

/**
 * リトライ付きドキュメント調査ワークフロー
 * コンテキスト長エラー時に自動でチャンク数を増やしてリトライする
 */
export const researchDocumentWithRetryWorkflow = createWorkflow({
  id: "researchDocumentWithRetryWorkflow",
  inputSchema: researchDocumentWithRetryInputSchema,
  outputSchema: researchDocumentWithRetryOutputSchema,
})
  .map(async ({ inputData }) => {
    // getTotalChunksStepの入力形式に変換
    return inputData as z.infer<typeof getTotalChunksStepInputSchema>;
  })
  .then(getTotalChunksStep)
  .map(async ({ inputData, getInitData, bail }) => {
    if (inputData.status === "failed") {
      return bail(inputData);
    }
    const initData = (await getInitData()) as z.infer<
      typeof researchDocumentWithRetryInputSchema
    >;
    return {
      ...inputData,
      question: initData.question,
      checklistResults: initData.checklistResults,
      retryCount: 0,
      finishReason: "error" as const,
    } as z.infer<typeof chunkResearchInnerWorkflowInputSchema>;
  })
  .dountil(
    createWorkflow({
      id: "chunkResearchInnerWorkflow",
      inputSchema: chunkResearchInnerWorkflowInputSchema,
      outputSchema: chunkResearchInnerWorkflowInputSchema,
    })
      .map(async ({ inputData }) => {
        const {
          documentCacheId,
          researchContent,
          reasoning,
          totalChunks,
          question,
          checklistResults,
        } = inputData;

        // ドキュメントキャッシュを取得
        const repository = new ReviewDocumentCacheRepository();
        const documentCache = await repository.findById(documentCacheId);

        if (!documentCache) {
          throw new Error(
            `ドキュメントキャッシュが見つかりませんでした: ${documentCacheId}`,
          );
        }

        // キャッシュからコンテンツを読み込み
        let textContent: string | null = null;
        let imageData: string[] | null = null;

        if (documentCache.cachePath) {
          if (documentCache.isTextMode()) {
            textContent = await ReviewCacheHelper.loadTextCache(
              documentCache.cachePath,
            );
          } else if (documentCache.isImageMode()) {
            imageData = await ReviewCacheHelper.loadImageCache(
              documentCache.cachePath,
            );
          }
        }

        // ドキュメントをtotalChunks分に分割
        const chunks: Array<{ text?: string; images?: string[] }> = [];

        if (documentCache.processMode === "text" && textContent) {
          // テキストをチャンク分割
          const textChunks = splitTextByCount(textContent, totalChunks);
          textChunks.forEach((chunkText) => {
            chunks.push({ text: chunkText });
          });
        } else if (documentCache.processMode === "image" && imageData) {
          // 画像配列をチャンク分割
          const imageChunks = splitImagesByCount(imageData, totalChunks);
          imageChunks.forEach((chunkImages) => {
            chunks.push({ images: chunkImages });
          });
        }

        // 各チャンクに対する調査タスクを作成
        return chunks.map((chunk, index) => ({
          documentCacheId,
          fileName: documentCache.fileName,
          researchContent,
          reasoning,
          chunkContent: chunk,
          chunkIndex: index,
          totalChunks,
          question,
          checklistResults,
        })) as z.infer<typeof researchChunkStepInputSchema>[];
      })
      .foreach(researchChunkStep, { concurrency: 5 })
      .map(async ({ inputData, bail, getInitData }) => {
        const initData = (await getInitData()) as z.infer<
          typeof chunkResearchInnerWorkflowInputSchema
        >;
        const results = inputData;

        // いずれかのチャンクでコンテキスト長エラーがあったかチェック
        const hasContentLengthError = results.some(
          (result) => result.finishReason === "content_length",
        );

        // コンテキスト長エラーがない場合、失敗が一つでもある場合は失敗として返す
        if (
          !hasContentLengthError &&
          results.some((result) => result.status === "failed")
        ) {
          const failed = results.find((result) => result.status === "failed");
          return {
            status: "failed" as const,
            errorMessage: failed?.errorMessage,
            finishReason: "error" as const,
            retryCount: initData.retryCount,
            documentCacheId: initData.documentCacheId,
            researchContent: initData.researchContent,
            reasoning: initData.reasoning,
            question: initData.question,
            checklistResults: initData.checklistResults,
            totalChunks: initData.totalChunks,
          } as z.infer<typeof chunkResearchInnerWorkflowInputSchema>;
        }

        // リトライ回数が5回を超えたら終了
        if (initData.retryCount >= 5) {
          return {
            status: "failed" as const,
            errorMessage: "ドキュメントが長すぎて処理できませんでした。",
            finishReason: "error" as const,
            retryCount: initData.retryCount,
            documentCacheId: initData.documentCacheId,
            researchContent: initData.researchContent,
            reasoning: initData.reasoning,
            question: initData.question,
            checklistResults: initData.checklistResults,
            totalChunks: initData.totalChunks,
          } as z.infer<typeof chunkResearchInnerWorkflowInputSchema>;
        }

        if (hasContentLengthError) {
          // チャンク数を増やして再試行
          logger.info(
            {
              documentCacheId: initData.documentCacheId,
              newTotalChunks: initData.totalChunks + 1,
            },
            "コンテキスト長エラーのためチャンク数を増やして再試行",
          );
          return {
            status: "success" as const,
            documentCacheId: initData.documentCacheId,
            researchContent: initData.researchContent,
            reasoning: initData.reasoning,
            question: initData.question,
            checklistResults: initData.checklistResults,
            totalChunks: initData.totalChunks + 1,
            finishReason: "content_length" as const,
            retryCount: initData.retryCount + 1,
          } as z.infer<typeof chunkResearchInnerWorkflowInputSchema>;
        }

        // すべて成功したらチャンク結果を統合
        const repository = new ReviewDocumentCacheRepository();
        const documentCache = await repository.findById(
          initData.documentCacheId,
        );
        if (!documentCache) {
          return {
            status: "failed" as const,
            errorMessage: "ドキュメントキャッシュが見つかりませんでした",
            finishReason: "error" as const,
            retryCount: initData.retryCount,
            documentCacheId: initData.documentCacheId,
            researchContent: initData.researchContent,
            reasoning: initData.reasoning,
            question: initData.question,
            checklistResults: initData.checklistResults,
            totalChunks: initData.totalChunks,
          } as z.infer<typeof chunkResearchInnerWorkflowInputSchema>;
        }

        // チャンク情報は削除し、調査結果のみを結合
        const combinedResult = results
          .filter((result) => result.chunkResult)
          .map(
            (result) =>
              `Document Name:\n${documentCache.fileName}${initData.totalChunks > 1 ? ` ※(Chunk ${result.chunkIndex! + 1}/${initData.totalChunks})(split into chunks because the full content did not fit into context)` : ""}\nResearch Findings:\n${result.chunkResult}`,
          )
          .join("\n\n---\n\n");

        return {
          status: "success" as const,
          documentCacheId: initData.documentCacheId,
          researchContent: initData.researchContent,
          reasoning: initData.reasoning,
          question: initData.question,
          checklistResults: initData.checklistResults,
          totalChunks: initData.totalChunks,
          researchResult: combinedResult,
          finishReason: "success" as const,
          retryCount: initData.retryCount,
        } as z.infer<typeof chunkResearchInnerWorkflowInputSchema>;
      })
      .commit(),
    async ({ inputData }) => {
      // 再試行上限または成功したら終了
      if (inputData.retryCount >= 6) {
        return true;
      }
      if (inputData.finishReason !== "content_length") {
        return true;
      }
      return false;
    },
  )
  .map(async ({ inputData, getInitData, runtimeContext }) => {
    // 最終結果を返す
    const initData = (await getInitData()) as z.infer<
      typeof researchDocumentWithRetryInputSchema
    >;
    const ctx =
      runtimeContext as RuntimeContext<QaExecutionWorkflowRuntimeContext>;
    const eventBroker = ctx.get("eventBroker");
    const qaHistoryId = ctx.get("qaHistoryId");

    // ドキュメント名を取得
    let documentName = "";
    try {
      const repository = new ReviewDocumentCacheRepository();
      const documentCache = await repository.findById(initData.documentCacheId);
      documentName = documentCache?.fileName || "";
    } catch {
      // エラー時は空文字列
    }

    // リアルタイムで調査進捗イベントをブロードキャスト（全購読者に配信）
    if (eventBroker && qaHistoryId) {
      const progressEvent: QaResearchProgressEvent = {
        type: "research_progress",
        data: {
          documentName,
          status: inputData.status === "success" ? "completed" : "in_progress",
          result: inputData.researchResult || undefined,
        },
      };
      eventBroker.broadcast(`qa:${qaHistoryId}`, progressEvent);
    }

    return {
      status: inputData.status,
      documentCacheId: inputData.documentCacheId,
      documentName,
      researchContent: inputData.researchContent,
      researchResult: inputData.researchResult,
      errorMessage: inputData.errorMessage,
    };
  })
  .commit();
