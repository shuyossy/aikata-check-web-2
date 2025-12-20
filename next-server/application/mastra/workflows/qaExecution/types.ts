import { z } from "zod";
import type { IEventBroker } from "@/application/shared/port/push/IEventBroker";
import type { BaseRuntimeContext } from "@/application/mastra/types";

/**
 * Q&A実行ワークフローのRuntimeContext型定義
 */
export type QaExecutionWorkflowRuntimeContext = BaseRuntimeContext & {
  /** SSEイベント発行用ブローカー */
  eventBroker: IEventBroker;
  /** ユーザーID */
  userId: string;
  /** Q&A履歴ID（イベント発行用） */
  qaHistoryId: string;
};

/**
 * レビューモード
 */
export const reviewModeSchema = z.enum(["large", "small"]);
export type ReviewMode = z.infer<typeof reviewModeSchema>;

/**
 * 利用可能ドキュメント情報
 */
export const availableDocumentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
});
export type AvailableDocument = z.infer<typeof availableDocumentSchema>;

/**
 * ドキュメントキャッシュ情報
 * レビュー時にキャッシュされたドキュメントの情報
 */
export const documentCacheSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  textContent: z.string().nullable().optional(),
  imageData: z.array(z.string()).nullable().optional(),
  processMode: z.enum(["text", "image"]),
});
export type DocumentCache = z.infer<typeof documentCacheSchema>;

/**
 * 調査タスク
 */
export const researchTaskSchema = z.object({
  documentCacheId: z.string(),
  researchContent: z.string(),
  reasoning: z.string(),
});
export type ResearchTask = z.infer<typeof researchTaskSchema>;

/**
 * 調査結果
 */
export const researchResultSchema = z.object({
  documentCacheId: z.string(),
  documentName: z.string(),
  researchContent: z.string(),
  researchResult: z.string(),
});
export type ResearchResult = z.infer<typeof researchResultSchema>;

/**
 * チェックリスト情報（個別レビュー結果含む）
 */
export const checklistResultWithIndividualSchema = z.object({
  checklistResult: z.object({
    id: z.string(),
    content: z.string(),
    evaluation: z.string().nullable().optional(),
    comment: z.string().nullable().optional(),
  }),
  individualResults: z
    .array(
      z.object({
        documentId: z.string(),
        comment: z.string(),
        individualFileName: z.string(),
      }),
    )
    .optional(),
});
export type ChecklistResultWithIndividual = z.infer<
  typeof checklistResultWithIndividualSchema
>;

/**
 * Q&A実行ワークフローの入力スキーマ
 */
export const qaExecutionTriggerSchema = z.object({
  /** レビュー対象ID */
  reviewTargetId: z.string(),
  /** 質問対象のチェック項目内容 */
  checkListItemContent: z.string(),
  /** ユーザーの質問 */
  question: z.string(),
});
export type QaExecutionTriggerInput = z.infer<typeof qaExecutionTriggerSchema>;
