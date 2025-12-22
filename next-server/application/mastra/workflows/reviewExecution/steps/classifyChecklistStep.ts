import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RuntimeContext } from "@mastra/core/di";
import { baseStepOutputSchema } from "../../schema";
import {
  checklistCategoryAgent,
  checklistCategoryOutputSchema,
} from "../../../agents";
import { createRuntimeContext } from "../../../lib/agentUtils";
import { normalizeUnknownError, workflowError } from "@/lib/server/error";
import type { ChecklistCategoryAgentRuntimeContext } from "../../../agents";
import {
  checkListItemSchema,
  type ReviewExecutionWorkflowRuntimeContext,
} from "../types";

/**
 * チェックリスト分類ステップの入力スキーマ
 */
export const classifyChecklistInputSchema = z.object({
  checkListItems: z.array(checkListItemSchema),
  concurrentReviewItems: z.number().optional(),
});

/**
 * チェックリスト分類ステップの出力スキーマ
 * chunksはチェック項目の2次元配列（チャンクごとに分割）
 */
export const classifyChecklistOutputSchema = baseStepOutputSchema.extend({
  chunks: z.array(z.array(checkListItemSchema)).optional(),
});

export type ClassifyChecklistInput = z.infer<
  typeof classifyChecklistInputSchema
>;
export type ClassifyChecklistOutput = z.infer<
  typeof classifyChecklistOutputSchema
>;

/**
 * チェック項目を指定サイズで均等分割する
 * AI分類が不要な場合やフォールバック時に使用
 */
function splitChecklistEqually<T>(items: T[], maxSize: number): T[][] {
  if (maxSize < 1) {
    throw workflowError("WORKFLOW_CHECKLIST_INVALID_SIZE");
  }
  if (items.length === 0) {
    return [];
  }

  // 必要なチャンク数を計算
  const parts = Math.ceil(items.length / maxSize);
  // 等分割のための基礎情報
  const baseSize = Math.floor(items.length / parts);
  const remainder = items.length % parts;

  const result: T[][] = [];
  let offset = 0;

  for (let i = 0; i < parts; i++) {
    // 先頭remainder個のチャンクには+1
    const thisSize = baseSize + (i < remainder ? 1 : 0);
    result.push(items.slice(offset, offset + thisSize));
    offset += thisSize;
  }

  return result;
}

/**
 * デフォルトの最大カテゴリ数
 */
const DEFAULT_MAX_CATEGORIES = 10;

/**
 * チェックリスト分類ステップ
 * チェックリストをconcurrentReviewItemsに基づいて分類・分割する
 *
 * 動作:
 * - concurrentReviewItems未指定または全項目数以上: 分割なし（1チャンク）
 * - concurrentReviewItems = 1: 単純に1件ずつ分割
 * - concurrentReviewItems >= 2: AIカテゴリ分類で意味的に分割
 * - AI分類失敗時: 単純均等分割にフォールバック
 */
export const classifyChecklistStep = createStep({
  id: "classify-checklist",
  description: "チェックリストをカテゴリ分類して分割する",
  inputSchema: classifyChecklistInputSchema,
  outputSchema: classifyChecklistOutputSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
    abortSignal,
  }): Promise<ClassifyChecklistOutput> => {
    try {
      const { checkListItems, concurrentReviewItems } = inputData;

      // チェック項目が空の場合
      if (checkListItems.length === 0) {
        return {
          status: "success",
          chunks: [],
        };
      }

      // デフォルトは全項目一括
      const chunkSize = concurrentReviewItems ?? checkListItems.length;

      // 分割不要の場合（全項目を一括でレビュー）
      if (chunkSize >= checkListItems.length) {
        return {
          status: "success",
          chunks: [checkListItems],
        };
      }

      // chunkSize = 1 の場合は単純に1件ずつ分割（AI分類不要）
      if (chunkSize <= 1) {
        return {
          status: "success",
          chunks: checkListItems.map((item) => [item]),
        };
      }

      // chunkSize >= 2 の場合はAIカテゴリ分類を実行
      try {
        const chunks = await classifyWithAI(
          checkListItems,
          chunkSize,
          workflowRuntimeContext as
            | RuntimeContext<ReviewExecutionWorkflowRuntimeContext>
            | undefined,
          abortSignal,
        );
        return {
          status: "success",
          chunks,
        };
      } catch {
        // AI分類失敗時は単純均等分割にフォールバック
        return {
          status: "success",
          chunks: splitChecklistEqually(checkListItems, chunkSize),
        };
      }
    } catch (error) {
      const normalizedError = normalizeUnknownError(error);
      return {
        status: "failed",
        errorMessage: normalizedError.message,
      };
    }
  },
});

/**
 * AIを使用してチェックリストをカテゴリ分類する
 */
async function classifyWithAI(
  checkListItems: { id: string; content: string }[],
  maxChecklistsPerCategory: number,
  workflowRuntimeContext?: RuntimeContext<ReviewExecutionWorkflowRuntimeContext>,
  abortSignal?: AbortSignal,
): Promise<{ id: string; content: string }[][]> {
  // workflowのRuntimeContextから確定済みのAI API設定を取得
  const employeeId = workflowRuntimeContext?.get("employeeId");
  const aiApiKey = workflowRuntimeContext?.get("aiApiKey");
  const aiApiUrl = workflowRuntimeContext?.get("aiApiUrl");
  const aiApiModel = workflowRuntimeContext?.get("aiApiModel");

  // エージェント用のRuntimeContextを作成
  const runtimeContext =
    createRuntimeContext<ChecklistCategoryAgentRuntimeContext>({
      maxChecklistsPerCategory,
      maxCategories: DEFAULT_MAX_CATEGORIES,
      employeeId,
      aiApiKey,
      aiApiUrl,
      aiApiModel,
    });

  // チェックリスト項目をフォーマット（1始まりの連番IDを使用してトークン消費を削減）
  const checklistPrompt = checkListItems
    .map((item, index) => `ID: ${index + 1} - ${item.content}`)
    .join("\n");

  try {
    // エージェントを実行
    const result = await checklistCategoryAgent.generateLegacy(
      `checklist items:\n${checklistPrompt}`,
      {
        output: checklistCategoryOutputSchema,
        runtimeContext,
        abortSignal,
      },
    );

    const rawCategories = result.object.categories;

    // 分類結果が空の場合はエラー（フォールバックへ）
    if (!rawCategories || rawCategories.length === 0) {
      throw workflowError("WORKFLOW_AI_CLASSIFICATION_EMPTY");
    }

    // 全ショートIDのセットを作成（1始まりの連番）
    const allShortIds = new Set(checkListItems.map((_, index) => index + 1));
    const assignedShortIds = new Set(
      rawCategories.flatMap((c) => c.checklistIds),
    );

    // 未分類アイテムがあれば「その他」カテゴリに追加
    const uncategorizedShortIds = Array.from(allShortIds).filter(
      (shortId) => !assignedShortIds.has(shortId),
    );
    if (uncategorizedShortIds.length > 0) {
      rawCategories.push({
        name: "その他",
        checklistIds: uncategorizedShortIds,
      });
    }

    // 重複排除とチャンク分割
    const seen = new Set<number>();
    const chunks: { id: string; content: string }[][] = [];

    for (const { checklistIds } of rawCategories) {
      // カテゴリ内の重複排除
      const uniqueInCategory = Array.from(new Set(checklistIds));

      // 他カテゴリで既に割り当て済みのショートIDを除外
      const filteredShortIds = uniqueInCategory.filter(
        (shortId) => !seen.has(shortId),
      );
      filteredShortIds.forEach((shortId) => seen.add(shortId));

      // maxChecklistsPerCategory件ずつチャンクに分割
      for (
        let i = 0;
        i < filteredShortIds.length;
        i += maxChecklistsPerCategory
      ) {
        const chunkShortIds = filteredShortIds.slice(
          i,
          i + maxChecklistsPerCategory,
        );

        // ショートID（1始まり）から元のチェック項目を取得
        const chunk = chunkShortIds
          .map((shortId) => {
            const index = shortId - 1;
            return index >= 0 && index < checkListItems.length
              ? checkListItems[index]
              : undefined;
          })
          .filter(
            (item): item is { id: string; content: string } =>
              item !== undefined,
          );

        if (chunk.length > 0) {
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  } catch (error) {
    throw error;
  }
}
