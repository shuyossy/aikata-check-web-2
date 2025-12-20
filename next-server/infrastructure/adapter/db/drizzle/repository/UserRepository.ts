import { eq, or, ilike, inArray, sql, and } from "drizzle-orm";
import {
  IUserRepository,
  SearchUsersOptions,
  FindAllUsersOptions,
} from "@/application/shared/port/repository";
import { User, UserId, EmployeeId } from "@/domain/user";
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
      isAdmin: row.isAdmin,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * ユーザIDでユーザを検索
   */
  async findById(id: UserId): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return User.reconstruct({
      id: row.id,
      employeeId: row.employeeId,
      displayName: row.displayName,
      isAdmin: row.isAdmin,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * 複数のユーザIDでユーザを検索
   */
  async findByIds(ids: UserId[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const result = await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          ids.map((id) => id.value),
        ),
      );

    return result.map((row) =>
      User.reconstruct({
        id: row.id,
        employeeId: row.employeeId,
        displayName: row.displayName,
        isAdmin: row.isAdmin,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * ユーザを検索（名前または社員IDで部分一致）
   */
  async searchUsers(
    query: string,
    options?: SearchUsersOptions,
  ): Promise<User[]> {
    const { limit = 10, offset = 0 } = options ?? {};

    const searchPattern = `%${query}%`;
    const result = await db
      .select()
      .from(users)
      .where(
        or(
          ilike(users.displayName, searchPattern),
          ilike(users.employeeId, searchPattern),
        ),
      )
      .limit(limit)
      .offset(offset);

    return result.map((row) =>
      User.reconstruct({
        id: row.id,
        employeeId: row.employeeId,
        displayName: row.displayName,
        isAdmin: row.isAdmin,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * ユーザ検索結果の件数をカウント
   */
  async countSearchUsers(query: string): Promise<number> {
    const searchPattern = `%${query}%`;
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        or(
          ilike(users.displayName, searchPattern),
          ilike(users.employeeId, searchPattern),
        ),
      );

    return Number(result[0]?.count ?? 0);
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
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .onConflictDoUpdate({
        target: users.employeeId,
        set: {
          displayName: user.displayName,
          isAdmin: user.isAdmin,
          updatedAt: user.updatedAt,
        },
      });
  }

  /**
   * 全ての管理者を取得
   */
  async findAllAdmins(): Promise<User[]> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.isAdmin, true))
      .orderBy(users.displayName);

    return result.map((row) =>
      User.reconstruct({
        id: row.id,
        employeeId: row.employeeId,
        displayName: row.displayName,
        isAdmin: row.isAdmin,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * 管理者の人数をカウント
   */
  async countAdmins(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isAdmin, true));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * 全ユーザを取得（検索・ページネーション対応）
   */
  async findAll(options?: FindAllUsersOptions): Promise<User[]> {
    const { query, limit = 50, offset = 0 } = options ?? {};

    let queryBuilder = db.select().from(users);

    if (query) {
      const searchPattern = `%${query}%`;
      queryBuilder = queryBuilder.where(
        or(
          ilike(users.displayName, searchPattern),
          ilike(users.employeeId, searchPattern),
        ),
      ) as typeof queryBuilder;
    }

    const result = await queryBuilder
      .orderBy(users.displayName)
      .limit(limit)
      .offset(offset);

    return result.map((row) =>
      User.reconstruct({
        id: row.id,
        employeeId: row.employeeId,
        displayName: row.displayName,
        isAdmin: row.isAdmin,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  /**
   * 全ユーザの件数をカウント
   */
  async countAll(query?: string): Promise<number> {
    let queryBuilder = db.select({ count: sql<number>`count(*)` }).from(users);

    if (query) {
      const searchPattern = `%${query}%`;
      queryBuilder = queryBuilder.where(
        or(
          ilike(users.displayName, searchPattern),
          ilike(users.employeeId, searchPattern),
        ),
      ) as typeof queryBuilder;
    }

    const result = await queryBuilder;
    return Number(result[0]?.count ?? 0);
  }
}
