import { z } from "zod";

/**
 * 外部APIレビュー機能で使用するスキーマ定義
 * クライアント・サーバー両方で使用可能
 */

// ===============================================
// ドキュメントスキーマ
// ===============================================

/**
 * ドキュメント種別
 * - text: テキストコンテンツ
 * - image: Base64エンコードされた画像
 */
export const documentTypeSchema = z.enum(["text", "image"]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

/**
 * 外部APIに送信するドキュメント
 */
export const externalReviewDocumentSchema = z.object({
  /** ドキュメント名（ファイル名） */
  name: z.string(),
  /** ドキュメント種別 */
  type: documentTypeSchema,
  /** コンテンツ（テキストまたはBase64エンコードされた画像） */
  content: z.string(),
});

export type ExternalReviewDocument = z.infer<typeof externalReviewDocumentSchema>;

// ===============================================
// チェックリストスキーマ
// ===============================================

/**
 * 外部APIに送信するチェックリスト項目
 */
export const externalReviewCheckListItemSchema = z.object({
  /** チェック項目ID */
  id: z.string(),
  /** チェック項目の内容 */
  content: z.string(),
});

export type ExternalReviewCheckListItem = z.infer<typeof externalReviewCheckListItemSchema>;

// ===============================================
// 評価基準スキーマ
// ===============================================

/**
 * 評価基準項目
 */
export const externalReviewEvaluationCriterionSchema = z.object({
  /** 評価ラベル（例: A, B, C） */
  label: z.string(),
  /** 評価の説明 */
  description: z.string(),
});

export type ExternalReviewEvaluationCriterion = z.infer<typeof externalReviewEvaluationCriterionSchema>;

// ===============================================
// レビュー設定スキーマ
// ===============================================

/**
 * 外部APIに送信するレビュー設定
 */
export const externalReviewSettingsSchema = z.object({
  /** 追加指示（システムプロンプトに追加される指示） */
  additionalInstructions: z.string().nullable().optional(),
  /** コメントフォーマット（レビューコメントのフォーマット指定） */
  commentFormat: z.string().nullable().optional(),
  /** 評価基準 */
  evaluationCriteria: z.array(externalReviewEvaluationCriterionSchema).optional(),
});

export type ExternalReviewSettings = z.infer<typeof externalReviewSettingsSchema>;

// ===============================================
// リクエストスキーマ
// ===============================================

/**
 * 外部APIへのリクエストスキーマ
 */
export const externalReviewRequestSchema = z.object({
  /** レビュー対象ドキュメント配列 */
  documents: z.array(externalReviewDocumentSchema),
  /** チェックリスト項目配列 */
  checkListItems: z.array(externalReviewCheckListItemSchema),
  /** レビュー設定（オプション） */
  reviewSettings: externalReviewSettingsSchema.optional(),
});

export type ExternalReviewRequest = z.infer<typeof externalReviewRequestSchema>;

// ===============================================
// レスポンススキーマ
// ===============================================

/**
 * 外部APIからのレビュー結果（単一項目）
 */
export const externalReviewResultItemSchema = z.object({
  /** チェック項目ID（リクエストで送信したIDと対応） */
  checkListItemId: z.string(),
  /** 評価結果（評価基準のラベル） */
  evaluation: z.string(),
  /** レビューコメント */
  comment: z.string(),
  /** エラーメッセージ（エラーが発生した場合のみ設定） */
  error: z.string().optional(),
});

export type ExternalReviewResultItem = z.infer<typeof externalReviewResultItemSchema>;

/**
 * 外部APIからのレスポンススキーマ
 */
export const externalReviewResponseSchema = z.object({
  /** レビュー結果配列 */
  results: z.array(externalReviewResultItemSchema),
});

export type ExternalReviewResponse = z.infer<typeof externalReviewResponseSchema>;

// ===============================================
// バリデーション関数
// ===============================================

/**
 * 外部APIレスポンスをバリデート
 * @param data 検証対象のデータ
 * @returns バリデーション結果
 */
export function validateExternalReviewResponse(data: unknown): {
  success: boolean;
  data?: ExternalReviewResponse;
  error?: string;
} {
  const result = externalReviewResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => i.message).join(", "),
  };
}

/**
 * 外部APIリクエストを構築
 * @param documents ドキュメント配列
 * @param checkListItems チェックリスト項目配列
 * @param reviewSettings レビュー設定（オプション）
 * @returns 外部APIリクエスト
 */
export function buildExternalReviewRequest(
  documents: ExternalReviewDocument[],
  checkListItems: ExternalReviewCheckListItem[],
  reviewSettings?: ExternalReviewSettings,
): ExternalReviewRequest {
  return {
    documents,
    checkListItems,
    reviewSettings,
  };
}
