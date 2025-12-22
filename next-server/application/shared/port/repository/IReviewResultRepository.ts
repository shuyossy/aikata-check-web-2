import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewResult, ReviewResultId } from "@/domain/reviewResult";

/**
 * レビュー結果リポジトリインターフェース
 */
export interface IReviewResultRepository {
  /**
   * IDでレビュー結果を検索
   * @param id レビュー結果ID
   * @returns レビュー結果エンティティ（存在しない場合はnull）
   */
  findById(id: ReviewResultId): Promise<ReviewResult | null>;

  /**
   * レビュー対象IDでレビュー結果一覧を検索
   * @param reviewTargetId レビュー対象ID
   * @returns レビュー結果エンティティの配列
   */
  findByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<ReviewResult[]>;

  /**
   * レビュー対象IDでレビュー結果数をカウント
   * @param reviewTargetId レビュー対象ID
   * @returns レビュー結果数
   */
  countByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<number>;

  /**
   * レビュー結果を保存（新規作成または更新）
   * @param reviewResult レビュー結果エンティティ
   */
  save(reviewResult: ReviewResult): Promise<void>;

  /**
   * 複数のレビュー結果を一括保存
   * @param reviewResults レビュー結果エンティティの配列
   */
  saveMany(reviewResults: ReviewResult[]): Promise<void>;

  /**
   * レビュー結果を削除
   * @param id レビュー結果ID
   */
  delete(id: ReviewResultId): Promise<void>;

  /**
   * レビュー対象IDに紐づくレビュー結果を全て削除
   * @param reviewTargetId レビュー対象ID
   */
  deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void>;
}
