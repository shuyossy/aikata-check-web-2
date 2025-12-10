import { eq } from "drizzle-orm";
import { IUserRepository } from "@/application/shared/port/repository";
import { User, EmployeeId } from "@/domain/user";
import { db } from "../index";
import { users } from "@/drizzle/schema";

/**
 * ユーザリポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class UserRepository implements IUserRepository {
  /**
   * 社員IDでユーザを検索
   */
  async findByEmployeeId(employeeId: EmployeeId): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.employeeId, employeeId.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return User.reconstruct({
      id: row.id,
      employeeId: row.employeeId,
      displayName: row.displayName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * ユーザを保存（新規作成または更新）
   */
  async save(user: User): Promise<void> {
    await db
      .insert(users)
      .values({
        id: user.id.value,
        employeeId: user.employeeId.value,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .onConflictDoUpdate({
        target: users.employeeId,
        set: {
          displayName: user.displayName,
          updatedAt: user.updatedAt,
        },
      });
  }
}
