import { Project, ProjectId } from "@/domain/project";
import { UserId } from "@/domain/user";

/**
 * プロジェクト検索オプション
 */
export interface FindProjectsOptions {
  /** 検索キーワード */
  search?: string;
  /** 取得件数 */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * プロジェクトリポジトリインターフェース
 * インフラ層で実装される
 */
export interface IProjectRepository {
  /**
   * IDでプロジェクトを検索（メンバー情報含む）
   * @param id プロジェクトID
   * @returns プロジェクトエンティティ（存在しない場合はnull）
   */
  findById(id: ProjectId): Promise<Project | null>;

  /**
   * ユーザIDでプロジェクト一覧を検索
   * @param userId ユーザID
   * @param options 検索オプション
   * @returns プロジェクトエンティティの配列
   */
  findByMemberId(
    userId: UserId,
    options?: FindProjectsOptions,
  ): Promise<Project[]>;

  /**
   * ユーザIDでプロジェクト数をカウント
   * @param userId ユーザID
   * @param search 検索キーワード
   * @returns プロジェクト数
   */
  countByMemberId(userId: UserId, search?: string): Promise<number>;

  /**
   * プロジェクトを保存（新規作成または更新）
   * @param project プロジェクトエンティティ
   */
  save(project: Project): Promise<void>;

  /**
   * プロジェクトを削除
   * @param id プロジェクトID
   */
  delete(id: ProjectId): Promise<void>;
}
