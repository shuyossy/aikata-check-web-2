import {
  IProjectRepository,
  IUserRepository,
} from "@/application/shared/port/repository";
import { ProjectListItemDto } from "@/domain/project";
import { UserId } from "@/domain/user";

/**
 * プロジェクト一覧取得クエリ（入力DTO）
 */
export interface ListUserProjectsQuery {
  /** ユーザID */
  userId: string;
  /** 検索キーワード */
  search?: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたりの件数 */
  limit?: number;
}

/**
 * プロジェクト一覧結果DTO
 */
export interface ListUserProjectsResult {
  /** プロジェクト一覧 */
  projects: ProjectListItemDto[];
  /** 総件数 */
  total: number;
  /** 現在のページ */
  page: number;
  /** 1ページあたりの件数 */
  limit: number;
}

/**
 * プロジェクト一覧取得サービス
 * ユーザが所属するプロジェクト一覧を取得する
 */
export class ListUserProjectsService {
  private static readonly DEFAULT_LIMIT = 12;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * プロジェクト一覧取得を実行
   * @param query 取得クエリ
   * @returns プロジェクト一覧結果
   */
  async execute(query: ListUserProjectsQuery): Promise<ListUserProjectsResult> {
    const { userId, search } = query;

    // ページネーションパラメータの正規化
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      ListUserProjectsService.MAX_LIMIT,
      Math.max(1, query.limit ?? ListUserProjectsService.DEFAULT_LIMIT),
    );
    const offset = (page - 1) * limit;

    const userIdVo = UserId.reconstruct(userId);

    // プロジェクト一覧を取得
    const [projects, total] = await Promise.all([
      this.projectRepository.findByMemberId(userIdVo, {
        search,
        limit,
        offset,
      }),
      this.projectRepository.countByMemberId(userIdVo, search),
    ]);

    // メンバーのユーザーIDを収集
    const memberUserIds = new Set<string>();
    for (const project of projects) {
      for (const member of project.members) {
        memberUserIds.add(member.userId.value);
      }
    }

    // ユーザー情報を取得
    const userIds = Array.from(memberUserIds).map((id) =>
      UserId.reconstruct(id),
    );
    const users = await this.userRepository.findByIds(userIds);

    // ユーザー名マップを作成
    const userNameMap = new Map<string, string>();
    for (const user of users) {
      userNameMap.set(user.id.value, user.displayName);
    }

    return {
      projects: projects.map((p) => p.toListItemDto(userNameMap)),
      total,
      page,
      limit,
    };
  }
}
