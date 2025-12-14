import { z } from "zod";
import {
  rawUploadFileMetaSchema,
  FileBuffersMap,
  ExtractedFile,
} from "../shared/types";
import { BaseRuntimeContext } from "../../types";

/**
 * チェック項目のスキーマ
 */
export const checkListItemSchema = z.object({
  id: z.string(),
  content: z.string(),
});

export type CheckListItem = z.infer<typeof checkListItemSchema>;

/**
 * 評価基準項目のスキーマ
 */
export const evaluationCriterionSchema = z.object({
  label: z.string(),
  description: z.string(),
});

export type EvaluationCriterion = z.infer<typeof evaluationCriterionSchema>;

/**
 * レビュー設定のスキーマ
 */
export const reviewSettingsInputSchema = z.object({
  additionalInstructions: z.string().nullable().optional(),
  concurrentReviewItems: z.number().optional(),
  commentFormat: z.string().nullable().optional(),
  evaluationCriteria: z.array(evaluationCriterionSchema).optional(),
});

export type ReviewSettingsInput = z.infer<typeof reviewSettingsInputSchema>;

/**
 * レビュー種別のスキーマ
 * - small: 少量レビュー（AIのコンテキストウィンドウに収まる場合）
 * - large: 大量レビュー（AIのコンテキストウィンドウに収まらない場合）
 */
export const reviewTypeSchema = z.enum(["small", "large"]);
export type ReviewType = z.infer<typeof reviewTypeSchema>;

/**
 * レビュー実行ワークフローのトリガースキーマ
 */
export const triggerSchema = z.object({
  /** アップロードされたファイルのメタデータ配列 */
  files: z.array(rawUploadFileMetaSchema),
  /** チェック項目一覧 */
  checkListItems: z.array(checkListItemSchema),
  /** レビュー設定 */
  reviewSettings: reviewSettingsInputSchema.optional(),
  /** レビュー種別（デフォルト: small） */
  reviewType: reviewTypeSchema.optional().default("small"),
});

export type TriggerInput = z.infer<typeof triggerSchema>;

/**
 * レビュー結果保存コールバック関数の型
 * チャンクごとのレビュー完了時に呼び出される
 */
export type OnReviewResultSavedCallback = (
  results: SingleReviewResult[],
  reviewTargetId: string,
) => Promise<void>;

/**
 * 抽出済みファイルキャッシュ保存コールバック関数の型
 * ファイル処理完了後に呼び出される（リトライ用のキャッシュ保存）
 */
export type OnExtractedFilesCachedCallback = (
  extractedFiles: ExtractedFile[],
  reviewTargetId: string,
) => Promise<void>;

/**
 * キャッシュされたドキュメント（リトライ時に使用）
 */
export interface CachedDocument {
  id: string;
  name: string;
  type: string;
  processMode: "text" | "image";
  textContent?: string;
  imageData?: string[];
}

/**
 * レビュー実行ワークフローのRuntimeContext
 * Bufferなど、zodでシリアライズできないデータを保持
 */
export interface ReviewExecutionWorkflowRuntimeContext extends BaseRuntimeContext {
  fileBuffers: FileBuffersMap;
  /** レビュー対象ID */
  reviewTargetId?: string;
  /** レビュー結果保存コールバック */
  onReviewResultSaved?: OnReviewResultSavedCallback;
  /** 抽出済みファイルキャッシュ保存コールバック（初回レビュー時にリトライ用キャッシュを保存） */
  onExtractedFilesCached?: OnExtractedFilesCachedCallback;
  /** キャッシュされたドキュメントを使用するか（リトライ時） */
  useCachedDocuments?: boolean;
  /** キャッシュされたドキュメント配列（リトライ時） */
  cachedDocuments?: CachedDocument[];
}

/**
 * 単一のレビュー結果
 */
export const singleReviewResultSchema = z.object({
  /** チェック項目の内容（スナップショット） */
  checkListItemContent: z.string(),
  evaluation: z.string().nullable(),
  comment: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export type SingleReviewResult = z.infer<typeof singleReviewResultSchema>;
