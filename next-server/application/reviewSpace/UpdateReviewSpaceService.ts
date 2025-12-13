import { IProjectRepository } from "@/application/shared/port/repository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import {
  ReviewSpaceDto,
  ReviewSpaceId,
  ReviewSettingsProps,
} from "@/domain/reviewSpace";
import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペース更新コマンド（入力DTO）
 */
export interface UpdateReviewSpaceCommand {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** スペース名（更新する場合のみ指定） */
  name?: string;
  /** スペース説明（更新する場合のみ指定） */
  description?: string | null;
  /** 既定のレビュー設定 */
  defaultReviewSettings: ReviewSettingsProps;
}

/**
 * レビュースペース更新サービス
 * レビュースペースの名前や説明を更新する
 */
export class UpdateReviewSpaceService {
  constructor(
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュースペース更新を実行
   * @param command 更新コマンド
   * @returns 更新後のレビュースペースDTO
   * @throws ドメインバリデーションエラー - レビュースペースが存在しない、またはアクセス権がない場合
   */
  async execute(command: UpdateReviewSpaceCommand): Promise<ReviewSpaceDto> {
    const { reviewSpaceId, userId, name, description, defaultReviewSettings } =
      command;

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

    // 更新処理
    let updatedReviewSpace = reviewSpace;

    if (name !== undefined) {
      updatedReviewSpace = updatedReviewSpace.updateName(name);
    }

    if (description !== undefined) {
      updatedReviewSpace = updatedReviewSpace.updateDescription(description);
    }

    // レビュー設定の更新
    updatedReviewSpace =
      updatedReviewSpace.updateDefaultReviewSettings(defaultReviewSettings);

    // 保存
    await this.reviewSpaceRepository.save(updatedReviewSpace);

    return updatedReviewSpace.toDto();
  }
}
