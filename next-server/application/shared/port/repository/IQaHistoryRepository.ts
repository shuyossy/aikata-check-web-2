import { ReviewTargetId } from "@/domain/reviewTarget";
import {
  QaHistory,
  QaHistoryId,
  Answer,
  ResearchSummary,
  QaStatus,
} from "@/domain/qaHistory";

/**
 * Q&A履歴検索オプション
 */
export interface FindQaHistoriesOptions {
  /** 取得件数制限 */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * Q&A履歴検索結果
 */
export interface FindQaHistoriesResult {
  /** Q&A履歴一覧 */
  items: QaHistory[];
  /** 総件数 */
  total: number;
}

/**
 * Q&A履歴リポジトリインターフェース
 */
export interface IQaHistoryRepository {
  /**
   * IDでQ&A履歴を検索
   * @param id Q&A履歴ID
   * @returns Q&A履歴エンティティ（存在しない場合はnull）
   */
  findById(id: QaHistoryId): Promise<QaHistory | null>;

  /**
   * レビュー対象IDでQ&A履歴一覧を検索
   * @param reviewTargetId レビュー対象ID
   * @param options 検索オプション
   * @returns Q&A履歴一覧と総件数
   */
  findByReviewTargetId(
    reviewTargetId: ReviewTargetId,
    options?: FindQaHistoriesOptions,
  ): Promise<FindQaHistoriesResult>;

  /**
   * Q&A履歴を保存（新規作成）
   * @param qaHistory Q&A履歴エンティティ
   */
  save(qaHistory: QaHistory): Promise<void>;

  /**
   * Q&A履歴の回答を更新（完了時）
   * @param id Q&A履歴ID
   * @param answer 回答
   * @param researchSummary 調査サマリー
   */
  updateAnswer(
    id: QaHistoryId,
    answer: Answer,
    researchSummary: ResearchSummary,
  ): Promise<void>;

  /**
   * Q&A履歴をエラー状態に更新
   * @param id Q&A履歴ID
   * @param errorMessage エラーメッセージ
   */
  updateError(id: QaHistoryId, errorMessage: string): Promise<void>;

  /**
   * Q&A履歴のステータスを更新
   * @param id Q&A履歴ID
   * @param status 新しいステータス
   */
  updateStatus(id: QaHistoryId, status: QaStatus): Promise<void>;

  /**
   * Q&A履歴を削除
   * @param id Q&A履歴ID
   */
  delete(id: QaHistoryId): Promise<void>;

  /**
   * レビュー対象IDに紐づくQ&A履歴を全て削除
   * @param reviewTargetId レビュー対象ID
   */
  deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void>;
}
