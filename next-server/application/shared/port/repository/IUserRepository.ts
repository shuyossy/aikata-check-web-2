import { User } from "@/domain/user";
import { EmployeeId } from "@/domain/user";

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
   * ユーザを保存（新規作成または更新）
   * @param user ユーザエンティティ
   */
  save(user: User): Promise<void>;
}
