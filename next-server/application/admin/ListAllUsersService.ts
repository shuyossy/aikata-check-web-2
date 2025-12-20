import { IUserRepository, FindAllUsersOptions } from "@/application/shared/port/repository";
import { UserDto } from "@/domain/user";

/**
 * 全ユーザ一覧取得クエリ
 */
export interface ListAllUsersQuery {
  /** 取得件数 */
  limit?: number;
  /** オフセット */
  offset?: number;
  /** 検索クエリ（名前または社員IDで部分一致） */
  query?: string;
}

/**
 * 全ユーザ一覧取得結果
 */
export interface ListAllUsersResult {
  /** ユーザ一覧 */
  users: UserDto[];
  /** 総件数 */
  total: number;
}

/**
 * 全ユーザ一覧取得サービス
 * 管理者画面でのユーザ検索に使用
 */
export class ListAllUsersService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * 全ユーザ一覧を取得する
   * @param query 取得クエリ
   * @returns ユーザ一覧と総件数
   */
  async execute(query: ListAllUsersQuery = {}): Promise<ListAllUsersResult> {
    const { limit, offset, query: searchQuery } = query;

    const options: FindAllUsersOptions = {
      limit,
      offset,
      query: searchQuery,
    };

    const [users, total] = await Promise.all([
      this.userRepository.findAll(options),
      this.userRepository.countAll(searchQuery),
    ]);

    return {
      users: users.map((user) => user.toDto()),
      total,
    };
  }
}
