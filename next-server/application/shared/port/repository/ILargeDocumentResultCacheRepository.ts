import { ReviewTargetId } from "@/domain/reviewTarget";

/**
 * 大量レビュー時の個別ドキュメントレビュー結果
 */
export interface LargeDocumentResultCache {
  id: string;
  reviewDocumentCacheId: string;
  reviewResultId: string;
  comment: string;
  totalChunks: number;
  chunkIndex: number;
  individualFileName: string;
  createdAt: Date;
}

/**
 * 大量ドキュメント結果キャッシュの新規作成時の入力
 */
export interface NewLargeDocumentResultCache {
  reviewDocumentCacheId: string;
  reviewResultId: string;
  comment: string;
  totalChunks: number;
  chunkIndex: number;
  individualFileName: string;
}

/**
 * チェックリスト結果と個別レビュー結果のペア
 * Q&A機能で使用
 */
export interface ChecklistResultWithIndividualResults {
  checklistItemContent: string;
  evaluation: string | null;
  comment: string | null;
  individualResults: Array<{
    documentId: string;
    comment: string;
    individualFileName: string;
  }>;
}

/**
 * 大量ドキュメント結果キャッシュリポジトリインターフェース
 */
export interface ILargeDocumentResultCacheRepository {
  /**
   * 大量ドキュメント結果キャッシュを保存
   * @param cache キャッシュデータ
   */
  save(cache: NewLargeDocumentResultCache): Promise<void>;

  /**
   * 複数の大量ドキュメント結果キャッシュを一括保存
   * @param caches キャッシュデータの配列
   */
  saveMany(caches: NewLargeDocumentResultCache[]): Promise<void>;

  /**
   * レビュー対象IDで大量ドキュメント結果キャッシュを検索
   * @param reviewTargetId レビュー対象ID
   * @returns キャッシュの配列
   */
  findByReviewTargetId(
    reviewTargetId: ReviewTargetId,
  ): Promise<LargeDocumentResultCache[]>;

  /**
   * レビュー対象IDで大量ドキュメント結果キャッシュを削除
   * @param reviewTargetId レビュー対象ID
   */
  deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void>;

  /**
   * チェックリスト結果と個別レビュー結果を取得
   * Q&A機能で使用
   * @param reviewTargetId レビュー対象ID
   * @param checklistItemContents 対象のチェック項目内容の配列
   * @returns チェックリスト結果と個別レビュー結果のペアの配列
   */
  findChecklistResultsWithIndividualResults(
    reviewTargetId: ReviewTargetId,
    checklistItemContents: string[],
  ): Promise<ChecklistResultWithIndividualResults[]>;

  /**
   * ドキュメントキャッシュIDに紐づく最大チャンク数を取得
   * Q&A機能でドキュメント調査時のチャンク数決定に使用
   * 過去のレビュー時に何チャンクで成功したかの履歴から、最大値を返す
   * @param documentCacheId ドキュメントキャッシュID
   * @returns 最大チャンク数（履歴がない場合は1）
   */
  getMaxTotalChunksForDocument(documentCacheId: string): Promise<number>;
}
