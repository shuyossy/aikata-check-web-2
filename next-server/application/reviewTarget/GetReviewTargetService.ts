import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";
import type { EvaluationCriterion } from "@/application/mastra";

/**
 * レビュー対象取得コマンド（入力DTO）
 */
export interface GetReviewTargetCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * レビュー結果DTO
 */
export interface ReviewResultDto {
  /** レビュー結果ID */
  id: string;
  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  checkListItemContent: string;
  /** 評価 */
  evaluation: string | null;
  /** コメント */
  comment: string | null;
  /** エラーメッセージ */
  errorMessage: string | null;
  /** 作成日時 */
  createdAt: Date;
}

/**
 * レビュー設定DTO
 */
export interface ReviewSettingsDto {
  /** 追加指示 */
  additionalInstructions: string | null;
  /** 同時レビュー項目数 */
  concurrentReviewItems?: number;
  /** コメントフォーマット */
  commentFormat: string | null;
  /** 評価基準 */
  evaluationCriteria?: EvaluationCriterion[];
}

/**
 * レビュー対象取得結果DTO
 */
export interface GetReviewTargetResult {
  /** レビュー対象ID */
  id: string;
  /** レビュースペースID */
  reviewSpaceId: string;
  /** レビュー対象名 */
  name: string;
  /** ステータス */
  status: string;
  /** レビュー設定 */
  reviewSettings: ReviewSettingsDto | null;
  /** レビュー結果一覧 */
  reviewResults: ReviewResultDto[];
  /** 作成日時 */
  createdAt: Date;
  /** 更新日時 */
  updatedAt: Date;
}

/**
 * レビュー対象取得サービス
 */
export class GetReviewTargetService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * レビュー対象を取得
   * @param command 取得コマンド
   * @returns レビュー対象とレビュー結果
   */
  async execute(
    command: GetReviewTargetCommand,
  ): Promise<GetReviewTargetResult> {
    const { reviewTargetId, userId } = command;

    // レビュー対象の取得
    const reviewTargetIdVo = ReviewTargetId.reconstruct(reviewTargetId);
    const reviewTarget =
      await this.reviewTargetRepository.findById(reviewTargetIdVo);
    if (!reviewTarget) {
      throw domainValidationError("REVIEW_TARGET_NOT_FOUND");
    }

    // レビュースペースの存在確認
    const reviewSpaceIdVo = ReviewSpaceId.reconstruct(
      reviewTarget.reviewSpaceId.value,
    );
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
      throw domainValidationError("REVIEW_TARGET_ACCESS_DENIED");
    }

    // レビュー結果の取得
    const reviewResults =
      await this.reviewResultRepository.findByReviewTargetId(reviewTargetIdVo);

    return {
      id: reviewTarget.id.value,
      reviewSpaceId: reviewTarget.reviewSpaceId.value,
      name: reviewTarget.name.value,
      status: reviewTarget.status.value,
      reviewSettings: reviewTarget.reviewSettings?.toDto() ?? null,
      reviewResults: reviewResults.map((r) => ({
        id: r.id.value,
        checkListItemContent: r.checkListItemContent,
        evaluation: r.evaluation?.value ?? null,
        comment: r.comment?.value ?? null,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt,
      })),
      createdAt: reviewTarget.createdAt,
      updatedAt: reviewTarget.updatedAt,
    };
  }
}
