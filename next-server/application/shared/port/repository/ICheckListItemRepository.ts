import { CheckListItem, CheckListItemId } from "@/domain/checkListItem";
import { ReviewSpaceId } from "@/domain/reviewSpace";

/**
 * チェック項目検索オプション
 */
export interface FindCheckListItemsOptions {
  /** 取得件数 */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * チェック項目リポジトリインターフェース
 * インフラ層で実装される
 */
export interface ICheckListItemRepository {
  /**
   * IDでチェック項目を検索
   * @param id チェック項目ID
   * @returns チェック項目エンティティ（存在しない場合はnull）
   */
  findById(id: CheckListItemId): Promise<CheckListItem | null>;

  /**
   * レビュースペースIDでチェック項目一覧を検索
   * @param reviewSpaceId レビュースペースID
   * @param options 検索オプション
   * @returns チェック項目エンティティの配列（createdAt昇順）
   */
  findByReviewSpaceId(
    reviewSpaceId: ReviewSpaceId,
    options?: FindCheckListItemsOptions,
  ): Promise<CheckListItem[]>;

  /**
   * レビュースペースIDでチェック項目数をカウント
   * @param reviewSpaceId レビュースペースID
   * @returns チェック項目数
   */
  countByReviewSpaceId(reviewSpaceId: ReviewSpaceId): Promise<number>;

  /**
   * チェック項目を保存（新規作成または更新）
   * @param item チェック項目エンティティ
   */
  save(item: CheckListItem): Promise<void>;

  /**
   * チェック項目を一括保存
   * 既存のチェック項目は全て削除され、新しいチェック項目で置き換えられる
   * @param reviewSpaceId レビュースペースID
   * @param items チェック項目エンティティの配列
   */
  bulkSave(reviewSpaceId: ReviewSpaceId, items: CheckListItem[]): Promise<void>;

  /**
   * チェック項目を削除
   * @param id チェック項目ID
   */
  delete(id: CheckListItemId): Promise<void>;

  /**
   * 複数のチェック項目を削除
   * @param ids チェック項目IDの配列
   */
  deleteMany(ids: CheckListItemId[]): Promise<void>;

  /**
   * レビュースペースのチェック項目を全て削除
   * @param reviewSpaceId レビュースペースID
   */
  deleteByReviewSpaceId(reviewSpaceId: ReviewSpaceId): Promise<void>;
}
