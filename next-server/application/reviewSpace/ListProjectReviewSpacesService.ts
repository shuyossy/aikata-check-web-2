import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { normalizePagination } from "@/application/shared/util";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceListItemDto } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペース一覧取得クエリ（入力DTO）
 */
export interface ListProjectReviewSpacesQuery {
  /** プロジェクトID */
  projectId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** 検索キーワード */
  search?: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたりの件数 */
  limit?: number;
}

/**
 * レビュースペース一覧結果DTO
 */
export interface ListProjectReviewSpacesResult {
  /** レビュースペース一覧 */
  spaces: ReviewSpaceListItemDto[];
  /** 総件数 */
  total: number;
  /** 現在のページ */
  page: number;
  /** 1ページあたりの件数 */
  limit: number;
}

/**
 * レビュースペース一覧取得サービス
 * プロジェクト配下のレビュースペース一覧を取得する
 */
export class ListProjectReviewSpacesService {
  private static readonly DEFAULT_LIMIT = 12;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュースペース一覧取得を実行
   * @param query 取得クエリ
   * @returns レビュースペース一覧結果
   */
  async execute(
    query: ListProjectReviewSpacesQuery,
  ): Promise<ListProjectReviewSpacesResult> {
    const { projectId, userId, search } = query;

    // プロジェクトの存在確認
    const projectIdVo = ProjectId.reconstruct(projectId);
    const project = await this.projectRepository.findById(projectIdVo);
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // プロジェクトへのアクセス権確認
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // ページネーションパラメータの正規化
    const { page, limit, offset } = normalizePagination({
      page: query.page,
      limit: query.limit,
      defaultLimit: ListProjectReviewSpacesService.DEFAULT_LIMIT,
      maxLimit: ListProjectReviewSpacesService.MAX_LIMIT,
    });

    // レビュースペース一覧を取得
    const [spaces, total] = await Promise.all([
      this.reviewSpaceRepository.findByProjectId(projectIdVo, {
        search,
        limit,
        offset,
      }),
      this.reviewSpaceRepository.countByProjectId(projectIdVo, search),
    ]);

    return {
      spaces: spaces.map((s) => s.toListItemDto()),
      total,
      page,
      limit,
    };
  }
}
