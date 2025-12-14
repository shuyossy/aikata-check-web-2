import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";
import { ProjectId } from "@/domain/project";
import {
  domainValidationError,
  internalError,
} from "@/lib/server/error";

/**
 * 外部APIレビュー結果の入力型
 */
export interface ApiReviewResultInput {
  /** チェック項目ID */
  checkListItemId: string;
  /** チェック項目の内容（スナップショット用） */
  checkListItemContent: string;
  /** 評定結果 */
  evaluation: string;
  /** コメント */
  comment: string;
  /** エラーメッセージ（エラーが発生した場合のみ設定） */
  error?: string;
}

/**
 * 外部APIレビュー結果保存コマンド（入力DTO）
 */
export interface SaveApiReviewResultsCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** レビュー結果配列 */
  results: ApiReviewResultInput[];
  /** チャンクインデックス（進捗表示用） */
  chunkIndex: number;
  /** 総チャンク数（進捗表示用） */
  totalChunks: number;
}

/**
 * 外部APIレビュー結果保存結果DTO
 */
export interface SaveApiReviewResultsResult {
  /** 保存した結果数 */
  savedCount: number;
  /** チャンクインデックス */
  chunkIndex: number;
  /** 総チャンク数 */
  totalChunks: number;
}

/**
 * 外部APIレビュー結果保存サービス
 * クライアントから送信されるチャンク単位のレビュー結果をDBに保存する
 */
export class SaveApiReviewResultsService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * 外部APIレビュー結果を保存
   * @param command 保存コマンド
   * @returns 保存結果
   */
  async execute(
    command: SaveApiReviewResultsCommand,
  ): Promise<SaveApiReviewResultsResult> {
    const { reviewTargetId, userId, results, chunkIndex, totalChunks } = command;

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

    // 結果がない場合はエラー
    if (results.length === 0) {
      throw internalError({
        expose: true,
        messageCode: "REVIEW_API_NO_RESULTS",
      });
    }

    // レビュー結果エンティティを作成
    const reviewResultEntities: ReviewResult[] = results.map((result) => {
      // エラーがある場合はエラーとして作成
      if (result.error) {
        return ReviewResult.createError({
          reviewTargetId,
          checkListItemContent: result.checkListItemContent,
          errorMessage: result.error,
        });
      }
      // 正常な場合は成功として作成
      return ReviewResult.createSuccess({
        reviewTargetId,
        checkListItemContent: result.checkListItemContent,
        evaluation: result.evaluation,
        comment: result.comment,
      });
    });

    // DBに保存
    await this.reviewResultRepository.saveMany(reviewResultEntities);

    return {
      savedCount: reviewResultEntities.length,
      chunkIndex,
      totalChunks,
    };
  }
}
