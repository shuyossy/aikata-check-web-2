import { ReviewDocumentCache, ReviewTargetId } from "@/domain/reviewTarget";

/**
 * レビュードキュメントキャッシュリポジトリインターフェース
 */
export interface IReviewDocumentCacheRepository {
  /**
   * IDでドキュメントキャッシュを検索
   * @param id ドキュメントキャッシュID
   * @returns ドキュメントキャッシュエンティティ、存在しない場合はnull
   */
  findById(id: string): Promise<ReviewDocumentCache | null>;

  /**
   * レビュー対象IDでドキュメントキャッシュ一覧を検索
   * @param reviewTargetId レビュー対象ID
   * @returns ドキュメントキャッシュエンティティの配列
   */
  findByReviewTargetId(
    reviewTargetId: ReviewTargetId,
  ): Promise<ReviewDocumentCache[]>;

  /**
   * ドキュメントキャッシュを保存
   * @param cache ドキュメントキャッシュエンティティ
   */
  save(cache: ReviewDocumentCache): Promise<void>;

  /**
   * 複数のドキュメントキャッシュを一括保存
   * @param caches ドキュメントキャッシュエンティティの配列
   */
  saveMany(caches: ReviewDocumentCache[]): Promise<void>;

  /**
   * レビュー対象IDでドキュメントキャッシュを削除
   * @param reviewTargetId レビュー対象ID
   */
  deleteByReviewTargetId(reviewTargetId: ReviewTargetId): Promise<void>;
}
