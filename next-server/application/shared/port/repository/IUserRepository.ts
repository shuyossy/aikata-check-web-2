import { User, UserId } from "@/domain/user";
import { EmployeeId } from "@/domain/user";

/**
 * ユーザ検索オプション
 */
export interface SearchUsersOptions {
  /** 取得件数 */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * ユーザリポジトリインターフェース
 * インフラ層で実装される
 */
export interface IUserRepository {
  /**
   * 社員IDでユーザを検索
   * @param employeeId 社員ID
   * @returns ユーザエンティティ（存在しない場合はnull）
   */
  findByEmployeeId(employeeId: EmployeeId): Promise<User | null>;

  /**
   * ユーザIDでユーザを検索
   * @param id ユーザID
   * @returns ユーザエンティティ（存在しない場合はnull）
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * 複数のユーザIDでユーザを検索
   * @param ids ユーザIDの配列
   * @returns ユーザエンティティの配列
   */
  findByIds(ids: UserId[]): Promise<User[]>;

  /**
   * ユーザを検索（名前または社員IDで部分一致）
   * @param query 検索クエリ
   * @param options 検索オプション
   * @returns ユーザエンティティの配列
   */
  searchUsers(query: string, options?: SearchUsersOptions): Promise<User[]>;

  /**
   * ユーザ検索結果の件数をカウント
   * @param query 検索クエリ
   * @returns 件数
   */
  countSearchUsers(query: string): Promise<number>;

  /**
   * ユーザを保存（新規作成または更新）
   * @param user ユーザエンティティ
   */
  save(user: User): Promise<void>;
}
