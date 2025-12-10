import { IUserRepository } from "@/application/shared/port/repository";
import { UserDto } from "@/domain/user";

/**
 * ユーザ検索クエリ（入力DTO）
 */
export interface SearchUsersQuery {
  /** 検索キーワード */
  query: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたりの件数 */
  limit?: number;
}

/**
 * ユーザ検索結果DTO
 */
export interface SearchUsersResult {
  /** ユーザ一覧 */
  users: UserDto[];
  /** 総件数 */
  total: number;
  /** 現在のページ */
  page: number;
  /** 1ページあたりの件数 */
  limit: number;
}

/**
 * ユーザ検索サービス
 * プロジェクトメンバー選択用にユーザを検索する
 */
export class SearchUsersService {
  private static readonly DEFAULT_LIMIT = 10;
  private static readonly MAX_LIMIT = 50;

  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * ユーザ検索を実行
   * @param query 検索クエリ
   * @returns ユーザ検索結果
   */
  async execute(query: SearchUsersQuery): Promise<SearchUsersResult> {
    const { query: searchQuery } = query;

    // ページネーションパラメータの正規化
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      SearchUsersService.MAX_LIMIT,
      Math.max(1, query.limit ?? SearchUsersService.DEFAULT_LIMIT),
    );
    const offset = (page - 1) * limit;

    // ユーザを検索
    const [users, total] = await Promise.all([
      this.userRepository.searchUsers(searchQuery, { limit, offset }),
      this.userRepository.countSearchUsers(searchQuery),
    ]);

    return {
      users: users.map((u) => u.toDto()),
      total,
      page,
      limit,
    };
  }
}
