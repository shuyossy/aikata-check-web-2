import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { ReviewSpaceDto, ReviewSpaceId } from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペース取得クエリ（入力DTO）
 */
export interface GetReviewSpaceQuery {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * レビュースペース取得サービス
 * 単一のレビュースペースを取得する
 */
export class GetReviewSpaceService {
  constructor(
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュースペース取得を実行
   * @param query 取得クエリ
   * @returns レビュースペースDTO
   * @throws ドメインバリデーションエラー - レビュースペースが存在しない、またはアクセス権がない場合
   */
  async execute(query: GetReviewSpaceQuery): Promise<ReviewSpaceDto> {
    const { reviewSpaceId, userId } = query;

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(reviewSpaceId);
    const reviewSpace =
      await this.reviewSpaceRepository.findById(reviewSpaceIdVo);
    if (!reviewSpace) {
      throw domainValidationError("REVIEW_SPACE_NOT_FOUND");
    }

    // プロジェクトの存在確認
    const project = await this.projectRepository.findById(
      reviewSpace.projectId,
    );
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }

    // プロジェクトへのアクセス権確認
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    return reviewSpace.toDto();
  }
}
