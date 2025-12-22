import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";

/**
 * レビュー対象一覧取得コマンド（入力DTO）
 */
export interface ListReviewTargetsCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** 取得件数上限（オプション） */
  limit?: number;
}

/**
 * レビュー対象リスト項目DTO
 */
export interface ReviewTargetListItemDto {
  /** レビュー対象ID */
  id: string;
  /** レビュー対象名 */
  name: string;
  /** ステータス */
  status: string;
  /** 作成日時 */
  createdAt: Date;
  /** 更新日時 */
  updatedAt: Date;
}

/**
 * レビュー対象一覧取得結果DTO
 */
export interface ListReviewTargetsResult {
  /** レビュー対象一覧 */
  reviewTargets: ReviewTargetListItemDto[];
  /** 総件数 */
  totalCount: number;
}

/**
 * レビュー対象一覧取得サービス
 */
export class ListReviewTargetsService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュー対象一覧を取得
   * @param command 取得コマンド
   * @returns レビュー対象一覧
   */
  async execute(
    command: ListReviewTargetsCommand,
  ): Promise<ListReviewTargetsResult> {
    const { reviewSpaceId, userId, limit } = command;

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

    // レビュー対象一覧を取得
    const reviewTargets =
      await this.reviewTargetRepository.findByReviewSpaceId(reviewSpaceIdVo);

    // limitが指定されている場合は結果を制限
    const limitedTargets = limit
      ? reviewTargets.slice(0, limit)
      : reviewTargets;

    return {
      reviewTargets: limitedTargets.map((r) => ({
        id: r.id.value,
        name: r.name.value,
        status: r.status.value,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      totalCount: reviewTargets.length,
    };
  }
}
