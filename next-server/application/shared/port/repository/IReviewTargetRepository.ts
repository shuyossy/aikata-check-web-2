import { ReviewSpaceId } from "@/domain/reviewSpace";
import {
  ReviewTarget,
  ReviewTargetId,
} from "@/domain/reviewTarget";

/**
 * レビュー対象検索オプション
 */
export interface FindReviewTargetsOptions {
  /** 取得件数上限 */
  limit?: number;
  /** オフセット */
  offset?: number;
  /** ステータスでフィルタ */
  status?: string;
}

/**
 * レビュー対象リポジトリインターフェース
 */
export interface IReviewTargetRepository {
  /**
   * IDでレビュー対象を検索
   * @param id レビュー対象ID
   * @returns レビュー対象エンティティ（存在しない場合はnull）
   */
  findById(id: ReviewTargetId): Promise<ReviewTarget | null>;

  /**
   * レビュースペースIDでレビュー対象一覧を検索
   * @param reviewSpaceId レビュースペースID
   * @param options 検索オプション
   * @returns レビュー対象エンティティの配列（作成日時降順）
   */
  findByReviewSpaceId(
    reviewSpaceId: ReviewSpaceId,
    options?: FindReviewTargetsOptions,
  ): Promise<ReviewTarget[]>;

  /**
   * レビュースペースIDでレビュー対象数をカウント
   * @param reviewSpaceId レビュースペースID
   * @returns レビュー対象数
   */
  countByReviewSpaceId(reviewSpaceId: ReviewSpaceId): Promise<number>;

  /**
   * レビュー対象を保存（新規作成または更新）
   * @param reviewTarget レビュー対象エンティティ
   */
  save(reviewTarget: ReviewTarget): Promise<void>;

  /**
   * レビュー対象を削除
   * @param id レビュー対象ID
   */
  delete(id: ReviewTargetId): Promise<void>;
}
