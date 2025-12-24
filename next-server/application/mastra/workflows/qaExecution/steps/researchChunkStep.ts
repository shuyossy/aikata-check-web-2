import { createStep } from "@mastra/core/workflows";
import type { RuntimeContext } from "@mastra/core/di";
import { z } from "zod";
import { baseStepOutputSchema } from "../../schema";
import {
  checklistResultWithIndividualSchema,
  type QaExecutionWorkflowRuntimeContext,
} from "../types";
import { judgeReviewMode, buildResearchChecklistInfo } from "../lib";
import type { QaResearchAgentRuntimeContext } from "@/application/mastra/agents/types";
import { createRuntimeContext } from "@/application/mastra/lib/agentUtils";
import { judgeErrorIsContentLengthError } from "@/application/mastra/lib/util";
import { normalizeUnknownError, workflowError } from "@/lib/server/error";
import { formatMessage } from "@/lib/server/messages";
import { getLogger } from "@/lib/server/logger";

const logger = getLogger();

/**
 * チャンク調査ステップの入力スキーマ
 */
export const researchChunkStepInputSchema = z.object({
  /** ドキュメントキャッシュID */
  documentCacheId: z.string(),
  /** ファイル名 */
  fileName: z.string(),
  /** 調査内容 */
  researchContent: z.string(),
  /** 調査理由 */
  reasoning: z.string(),
  /** チャンクコンテンツ */
  chunkContent: z.object({
    text: z.string().optional(),
    images: z.array(z.string()).optional(),
  }),
  /** チャンクインデックス */
  chunkIndex: z.number(),
  /** 総チャンク数 */
  totalChunks: z.number(),
  /** ユーザーの質問 */
  question: z.string(),
  /** チェックリスト結果（個別結果含む） */
  checklistResults: z.array(checklistResultWithIndividualSchema),
});

export type ResearchChunkStepInput = z.infer<
  typeof researchChunkStepInputSchema
>;

/**
 * チャンク調査ステップの出力スキーマ
 */
export const researchChunkStepOutputSchema = baseStepOutputSchema.extend({
  /** チャンク調査結果 */
  chunkResult: z.string().optional(),
  /** チャンクインデックス */
  chunkIndex: z.number().optional(),
  /** 終了理由 */
  finishReason: z.enum(["success", "error", "content_length"]).optional(),
});

export type ResearchChunkStepOutput = z.infer<
  typeof researchChunkStepOutputSchema
>;

/**
 * チャンク調査ステップ
 * チャンク単位でドキュメントを調査する
 */
export const researchChunkStep = createStep({
  id: "researchChunkStep",
  description: "チャンク単位でドキュメントを調査するステップ",
  inputSchema: researchChunkStepInputSchema,
  outputSchema: researchChunkStepOutputSchema,
  execute: async ({
    inputData,
    bail,
    mastra,
    runtimeContext: workflowRuntimeContext,
  }) => {
    try {
      const {
        fileName,
        researchContent,
        chunkContent,
        chunkIndex,
        totalChunks,
        question,
        checklistResults,
      } = inputData;

      // レビューモードを判定
      const reviewMode = judgeReviewMode(checklistResults);

      // チェックリスト情報の文字列を生成
      const checklistInfo = buildResearchChecklistInfo(checklistResults);

      // ワークフローRuntimeContextから確定済みのAI API設定を取得
      const typedWorkflowRuntimeContext = workflowRuntimeContext as
        | RuntimeContext<QaExecutionWorkflowRuntimeContext>
        | undefined;
      const employeeId = typedWorkflowRuntimeContext?.get("employeeId");
      const aiApiKey = typedWorkflowRuntimeContext?.get("aiApiKey");
      const aiApiUrl = typedWorkflowRuntimeContext?.get("aiApiUrl");
      const aiApiModel = typedWorkflowRuntimeContext?.get("aiApiModel");

      // RuntimeContext作成
      const runtimeContext =
        createRuntimeContext<QaResearchAgentRuntimeContext>({
          researchContent,
          totalChunks,
          chunkIndex,
          fileName,
          checklistInfo,
          userQuestion: question,
          reviewMode,
          employeeId,
          aiApiKey,
          aiApiUrl,
          aiApiModel,
        });

      // メッセージを作成
      const messageContent: Array<
        | { type: "text"; text: string }
        | { type: "image"; image: string; mimeType: string }
      > = [];

      if (chunkContent.text) {
        // テキストチャンクの場合
        messageContent.push({
          type: "text",
          text: `Document: ${fileName}\n\nResearch Instructions: ${researchContent}\n\nDocument Content:\n${chunkContent.text}`,
        });
      } else if (chunkContent.images && chunkContent.images.length > 0) {
        // 画像チャンクの場合
        messageContent.push({
          type: "text",
          text: `Document: ${fileName}\n\nResearch Instructions: ${researchContent}\n\nPlease analyze the following document images:`,
        });
        chunkContent.images.forEach((imageBase64) => {
          messageContent.push({
            type: "image",
            image: imageBase64,
            mimeType: "image/png",
          });
        });
      } else {
        return bail({
          status: "failed" as const,
          errorMessage: formatMessage("WORKFLOW_QA_CHUNK_CONTENT_EMPTY"),
          finishReason: "error" as const,
        });
      }

      // Mastraエージェント経由でAI呼び出し
      const researchAgent = mastra?.getAgent("qaResearchAgent");
      if (!researchAgent) {
        throw workflowError("WORKFLOW_AGENT_NOT_FOUND");
      }

      const result = await researchAgent.generateLegacy(
        {
          role: "user",
          content: messageContent,
        },
        {
          runtimeContext,
        },
      );

      return {
        status: "success" as const,
        chunkIndex,
        chunkResult: result.text,
        finishReason: "success" as const,
      };
    } catch (error) {
      // コンテキスト長エラーの場合は特別な処理
      if (judgeErrorIsContentLengthError(error)) {
        return {
          status: "success" as const,
          chunkIndex: inputData.chunkIndex,
          finishReason: "content_length" as const,
        };
      }

      logger.error({ err: error }, "チャンク調査に失敗しました");
      const normalizedError = normalizeUnknownError(error);
      return bail({
        status: "failed" as const,
        errorMessage: normalizedError.message,
        finishReason: "error" as const,
      });
    }
  },
});
