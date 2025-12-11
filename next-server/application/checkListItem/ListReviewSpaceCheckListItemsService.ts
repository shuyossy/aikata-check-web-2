import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { normalizePagination } from "@/application/shared/util";
import { CheckListItemListItemDto } from "@/domain/checkListItem";
import { ProjectId } from "@/domain/project";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * チェック項目一覧取得クエリ（入力DTO）
 */
export interface ListReviewSpaceCheckListItemsQuery {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたりの件数 */
  limit?: number;
}

/**
 * チェック項目一覧結果DTO
 */
export interface ListReviewSpaceCheckListItemsResult {
  /** チェック項目一覧 */
  items: CheckListItemListItemDto[];
  /** 総件数 */
  total: number;
  /** 現在のページ */
  page: number;
  /** 1ページあたりの件数 */
  limit: number;
}

/**
 * チェック項目一覧取得サービス
 * レビュースペース配下のチェック項目一覧を取得する
 */
export class ListReviewSpaceCheckListItemsService {
  private static readonly DEFAULT_LIMIT = 100;
  private static readonly MAX_LIMIT = 1000;

  constructor(
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * チェック項目一覧取得を実行
   * @param query 取得クエリ
   * @returns チェック項目一覧結果
   */
  async execute(
    query: ListReviewSpaceCheckListItemsQuery,
  ): Promise<ListReviewSpaceCheckListItemsResult> {
    const { reviewSpaceId, userId } = query;

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(reviewSpaceId);
    const reviewSpace =
      await this.reviewSpaceRepository.findById(reviewSpaceIdVo);
    if (!reviewSpace) {
      throw domainValidationError("REVIEW_SPACE_NOT_FOUND");
    }

    // プロジェクトの存在確認
    const projectId = ProjectId.reconstruct(reviewSpace.projectId.value);
    const project = await this.projectRepository.findById(projectId);
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
      defaultLimit: ListReviewSpaceCheckListItemsService.DEFAULT_LIMIT,
      maxLimit: ListReviewSpaceCheckListItemsService.MAX_LIMIT,
    });

    // チェック項目一覧を取得
    const [items, total] = await Promise.all([
      this.checkListItemRepository.findByReviewSpaceId(reviewSpaceIdVo, {
        limit,
        offset,
      }),
      this.checkListItemRepository.countByReviewSpaceId(reviewSpaceIdVo),
    ]);

    return {
      items: items.map((item) => item.toListItemDto()),
      total,
      page,
      limit,
    };
  }
}
