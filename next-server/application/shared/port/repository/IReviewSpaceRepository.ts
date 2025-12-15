import { ReviewSpace, ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";

/**
 * レビュースペース検索オプション
 */
export interface FindReviewSpacesOptions {
  /** 検索キーワード */
  search?: string;
  /** 取得件数 */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * レビュースペースリポジトリインターフェース
 * インフラ層で実装される
 */
export interface IReviewSpaceRepository {
  /**
   * IDでレビュースペースを検索
   * @param id レビュースペースID
   * @returns レビュースペースエンティティ（存在しない場合はnull）
   */
  findById(id: ReviewSpaceId): Promise<ReviewSpace | null>;

  /**
   * プロジェクトIDでレビュースペース一覧を検索
   * @param projectId プロジェクトID
   * @param options 検索オプション
   * @returns レビュースペースエンティティの配列
   */
  findByProjectId(
    projectId: ProjectId,
    options?: FindReviewSpacesOptions,
  ): Promise<ReviewSpace[]>;

  /**
   * プロジェクトIDでレビュースペース数をカウント
   * @param projectId プロジェクトID
   * @param search 検索キーワード
   * @returns レビュースペース数
   */
  countByProjectId(projectId: ProjectId, search?: string): Promise<number>;

  /**
   * レビュースペースを保存（新規作成または更新）
   * @param reviewSpace レビュースペースエンティティ
   */
  save(reviewSpace: ReviewSpace): Promise<void>;

  /**
   * レビュースペースを削除
   * @param id レビュースペースID
   */
  delete(id: ReviewSpaceId): Promise<void>;

  /**
   * チェックリスト生成エラーを更新
   * @param id レビュースペースID
   * @param errorMessage エラーメッセージ（nullでクリア）
   */
  updateChecklistGenerationError(
    id: ReviewSpaceId,
    errorMessage: string | null,
  ): Promise<void>;
}
