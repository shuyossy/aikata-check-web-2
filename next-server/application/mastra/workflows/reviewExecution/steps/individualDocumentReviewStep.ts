import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RuntimeContext } from "@mastra/core/di";
import {
  individualDocumentReviewAgent,
  individualDocumentReviewOutputSchema as agentOutputSchema,
} from "../../../agents";
import { baseStepOutputSchema } from "../../schema";
import { extractedFileSchema } from "../../shared";
import { createCombinedMessage } from "../../lib";
import { createRuntimeContext, judgeFinishReason } from "../../../lib/agentUtils";
import { judgeErrorIsContentLengthError } from "../../../lib/util";
import { normalizeUnknownError } from "@/lib/server/error";
import { formatMessage } from "@/lib/server/messages";
import type { IndividualDocumentReviewAgentRuntimeContext } from "../../../agents";
import {
  checkListItemSchema,
  type ReviewExecutionWorkflowRuntimeContext,
} from "../types";

/**
 * 個別ドキュメントレビュー結果のスキーマ
 * 評定は含まず、コメントのみを保持（評定は統合ステップで付与）
 */
export const individualDocumentReviewResultSchema = z.object({
  /** ドキュメントID */
  documentId: z.string(),
  /** ドキュメント名 */
  documentName: z.string(),
  /** チェック項目ID */
  checklistId: z.string(),
  /** レビューコメント */
  comment: z.string(),
});

export type IndividualDocumentReviewResult = z.infer<
  typeof individualDocumentReviewResultSchema
>;

/**
 * 個別ドキュメントレビューステップの入力スキーマ
 * fileProcessingStepで処理済みのExtractedFileを受け取る
 */
export const individualDocumentReviewInputSchema = z.object({
  /** 抽出済みファイル（単一ドキュメントまたはチャンク） */
  file: extractedFileSchema.extend({
    /** 元のファイル名（分割時に使用） */
    originalName: z.string().optional(),
    /** チャンク総数（分割時に設定） */
    totalChunks: z.number().optional(),
    /** 何番目のチャンクか（0から始まる） */
    chunkIndex: z.number().optional(),
  }),
  /** チェック項目一覧 */
  checkListItems: z.array(checkListItemSchema),
  /** 追加指示（オプション） */
  additionalInstructions: z.string().nullable().optional(),
  /** コメントフォーマット（オプション） */
  commentFormat: z.string().nullable().optional(),
});

/**
 * 個別ドキュメントレビューステップの出力スキーマ
 */
export const individualDocumentReviewOutputSchema = baseStepOutputSchema.extend({
  /** レビュー結果配列 */
  reviewResults: z.array(individualDocumentReviewResultSchema).optional(),
  /** 終了理由 */
  finishReason: z.enum(["success", "error", "content_length"]),
});

export type IndividualDocumentReviewInput = z.infer<
  typeof individualDocumentReviewInputSchema
>;
export type IndividualDocumentReviewOutput = z.infer<
  typeof individualDocumentReviewOutputSchema
>;

/**
 * 最大リトライ回数
 * レビュー結果に含まれなかったチェック項目を再度レビューする際の最大試行回数
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * 個別ドキュメントレビューステップ
 * 大量レビュー時に各ドキュメント（またはドキュメントの一部）をレビューする
 * 評定は付与せず、コメントのみを生成する
 */
export const individualDocumentReviewStep = createStep({
  id: "individual-document-review",
  description: "個別ドキュメントに対するレビュー実行（評定なし）",
  inputSchema: individualDocumentReviewInputSchema,
  outputSchema: individualDocumentReviewOutputSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
  }): Promise<IndividualDocumentReviewOutput> => {
    const { file, checkListItems, additionalInstructions, commentFormat } =
      inputData;

    // workflowのRuntimeContextから各種設定を取得
    const typedWorkflowRuntimeContext = workflowRuntimeContext as
      | RuntimeContext<ReviewExecutionWorkflowRuntimeContext>
      | undefined;
    const employeeId = typedWorkflowRuntimeContext?.get("employeeId");
    const projectApiKey = typedWorkflowRuntimeContext?.get("projectApiKey");

    try {
      // 動的に出力スキーマを作成（チェックリストIDは1始まり連番）
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
              "files and sections that should be reviewed for commenting",
            ),
          comment: z.string().describe("review comment"),
        }),
      );

      // 結果を格納する配列
      const reviewResults: IndividualDocumentReviewResult[] = [];
      let targetChecklistItems = [...checkListItems];
      let attempt = 0;

      // ドキュメント情報テキストを構築
      const originalName = file.originalName ?? file.name;
      const isChunk =
        file.totalChunks !== undefined && file.totalChunks > 1;
      const documentInfoText = isChunk
        ? `Document Information:
- Original File Name: ${originalName}
- Current Document Name: ${file.name}
- Note: This is part ${(file.chunkIndex ?? 0) + 1} of ${file.totalChunks} of the original document that was split due to length constraints`
        : `Document Information:
- File Name: ${file.name}`;

      // メッセージコンテンツを作成（一度だけ）
      const baseContent = createCombinedMessage(
        [file],
        "Please review this document against the provided checklist items",
      );

      // チェックリストリマインダーを作成する関数（1始まりの連番IDを使用してトークン消費を削減）
      const createChecklistReminder = (
        items: typeof checkListItems,
      ): string => {
        return `${documentInfoText}

## Checklist Items to Review:
${items.map((item, index) => `- ID: ${index + 1} - ${item.content}`).join("\n")}

Please provide a thorough review based on the document content provided above.`;
      };

      // 最大リトライ回数までレビューを繰り返す
      while (attempt < MAX_RETRY_ATTEMPTS && targetChecklistItems.length > 0) {
        // エージェント用のRuntimeContextを作成
        const runtimeContext =
          createRuntimeContext<IndividualDocumentReviewAgentRuntimeContext>({
            checklistItems: targetChecklistItems,
            additionalInstructions: additionalInstructions ?? undefined,
            commentFormat: commentFormat ?? undefined,
            projectApiKey,
            employeeId,
          });

        // チェックリストリマインダーを追加
        const checklistReminder = createChecklistReminder(targetChecklistItems);
        const messageWithReminder = [
          ...baseContent,
          { type: "text" as const, text: checklistReminder },
        ];

        // エージェントを実行
        const result = await individualDocumentReviewAgent.generateLegacy(
          {
            role: "user",
            content: messageWithReminder,
          },
          {
            output: dynamicOutputSchema,
            runtimeContext,
          },
        );

        // finishReason='length'の場合はコンテキスト長エラーとしてbailする
        if (result.finishReason === "length") {
          return {
            status: "failed",
            errorMessage: formatMessage("REVIEW_LARGE_DOC_CONTENT_TOO_LONG", {
              detail: targetChecklistItems.map((c) => `・${c.content}`).join("\n"),
            }),
            finishReason: "content_length",
          };
        }

        // finishReasonを確認（その他のエラーを検知）
        const { success: finishSuccess, reason: finishReasonMsg } =
          judgeFinishReason(result.finishReason);
        if (!finishSuccess) {
          throw new Error(`AI APIエラー: ${finishReasonMsg}`);
        }

        // 構造化出力を取得
        const output = result.object;

        if (output && Array.isArray(output)) {
          // 既にレビュー済みのチェック項目IDを取得
          const existingIds = new Set(reviewResults.map((r) => r.checklistId));

          // レビュー結果を格納（重複は追加しない）
          for (const item of output) {
            // AIの出力にはショートID（1始まり連番）が含まれるので、配列インデックスで取得
            const targetItem = targetChecklistItems[item.checklistId - 1];
            if (targetItem && !existingIds.has(targetItem.id)) {
              reviewResults.push({
                documentId: file.id,
                documentName: file.name,
                checklistId: targetItem.id,
                comment: item.comment,
              });
            }
          }

          // レビューされたショートIDを取得
          const reviewedShortIds = new Set(output.map((r) => r.checklistId));

          // まだレビューされていないチェック項目を抽出（インデックス+1がショートID）
          targetChecklistItems = targetChecklistItems.filter(
            (_, index) => !reviewedShortIds.has(index + 1),
          );
        }

        attempt += 1;
      }

      // リトライ後もレビューされなかったチェック項目はエラーとして記録
      if (targetChecklistItems.length > 0) {
        return {
          status: "failed",
          errorMessage: formatMessage("REVIEW_AI_OUTPUT_MISSING_RESULT", {
            detail: targetChecklistItems.map((c) => `・${c.content}`).join("\n"),
          }),
          reviewResults,
          finishReason: "error",
        };
      }

      return {
        status: "success",
        reviewResults,
        finishReason: "success",
      };
    } catch (error) {
      // エラーを正規化して統一的に処理
      const normalizedError = normalizeUnknownError(error);
      const isCtxLengthError = judgeErrorIsContentLengthError(error);

      return {
        status: "failed",
        errorMessage: normalizedError.message,
        finishReason: isCtxLengthError ? "content_length" : "error",
      };
    }
  },
});
