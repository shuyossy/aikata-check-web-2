import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ProjectId } from "@/domain/project";
import {
  domainValidationError,
  internalError,
} from "@/lib/server/error";

/**
 * 外部APIレビュー完了コマンド（入力DTO）
 */
export interface CompleteApiReviewCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** エラー発生フラグ（エラーステータスにする場合true） */
  hasError?: boolean;
}

/**
 * 外部APIレビュー完了結果DTO
 */
export interface CompleteApiReviewResult {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 最終ステータス */
  status: string;
}

/**
 * 外部APIレビュー完了サービス
 * レビュー対象のステータスをcompleted/errorに更新する
 */
export class CompleteApiReviewService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * 外部APIレビューを完了
   * @param command 完了コマンド
   * @returns 完了結果
   */
  async execute(
    command: CompleteApiReviewCommand,
  ): Promise<CompleteApiReviewResult> {
    const { reviewTargetId, userId, hasError = false } = command;

    // レビュー対象の取得
    const reviewTargetIdVo = ReviewTargetId.reconstruct(reviewTargetId);
    const reviewTarget =
      await this.reviewTargetRepository.findById(reviewTargetIdVo);
    if (!reviewTarget) {
      throw domainValidationError("REVIEW_TARGET_NOT_FOUND");
    }

    // レビュー種別がAPIであることを確認
    if (!reviewTarget.reviewType?.isApi()) {
      throw internalError({
        expose: true,
        messageCode: "REVIEW_TYPE_INVALID",
      });
    }

    // レビュー中のステータスであることを確認
    if (!reviewTarget.status.isReviewing()) {
      throw internalError({
        expose: true,
        messageCode: "REVIEW_STATUS_NOT_REVIEWING",
      });
    }

    // プロジェクトへのアクセス権確認
    const reviewSpace = await this.reviewSpaceRepository.findById(
      reviewTarget.reviewSpaceId,
    );
    if (!reviewSpace) {
      throw domainValidationError("REVIEW_SPACE_NOT_FOUND");
    }
    const projectId = ProjectId.reconstruct(reviewSpace.projectId.value);
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw domainValidationError("PROJECT_NOT_FOUND");
    }
    if (!project.hasMember(userId)) {
      throw domainValidationError("PROJECT_ACCESS_DENIED");
    }

    // ステータスを更新
    let updatedTarget;
    if (hasError) {
      updatedTarget = reviewTarget.markAsError();
    } else {
      updatedTarget = reviewTarget.completeReview();
    }

    // DBに保存
    await this.reviewTargetRepository.save(updatedTarget);

    return {
      reviewTargetId: updatedTarget.id.value,
      status: updatedTarget.status.value,
    };
  }
}
