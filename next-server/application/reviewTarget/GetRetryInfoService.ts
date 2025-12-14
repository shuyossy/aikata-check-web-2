import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ProjectId } from "@/domain/project";
import { domainValidationError } from "@/lib/server/error";
import { ReviewSettingsDto } from "@/domain/reviewSpace/ReviewSettings";
import { ReviewTypeValue } from "@/domain/reviewTarget";

/**
 * リトライ情報取得コマンド
 */
export interface GetRetryInfoCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
}

/**
 * リトライ情報DTO
 */
export interface RetryInfoDto {
  /** リトライ可能かどうか */
  canRetry: boolean;
  /** 前回のレビュー種別 */
  reviewType: ReviewTypeValue | null;
  /** 前回のレビュー設定 */
  previousSettings: ReviewSettingsDto | null;
  /** 失敗項目数（errorMessageがnullでないレビュー結果の数） */
  failedItemCount: number;
  /** 全項目数（全レビュー結果の数） */
  totalItemCount: number;
  /** スナップショットと最新チェックリストの差分有無 */
  hasChecklistDiff: boolean;
  /** スナップショットのチェックリスト項目数（review_resultsから取得） */
  snapshotChecklistCount: number;
  /** 現在のチェックリスト項目数（check_list_itemsから取得） */
  currentChecklistCount: number;
  /** ドキュメントキャッシュが存在するか */
  hasCachedDocuments: boolean;
}

/**
 * リトライ情報取得サービス
 * リトライ画面に表示する情報を取得する
 */
export class GetRetryInfoService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewDocumentCacheRepository: IReviewDocumentCacheRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * リトライ情報を取得する
   * @param command コマンド
   * @returns リトライ情報DTO
   */
  async execute(command: GetRetryInfoCommand): Promise<RetryInfoDto> {
    const { reviewTargetId, userId } = command;

    // レビュー対象の存在確認
    const reviewTargetIdVo = ReviewTargetId.reconstruct(reviewTargetId);
    const reviewTarget =
      await this.reviewTargetRepository.findById(reviewTargetIdVo);
    if (!reviewTarget) {
      throw domainValidationError("REVIEW_TARGET_NOT_FOUND");
    }

    // レビュースペースの存在確認
    const reviewSpace = await this.reviewSpaceRepository.findById(reviewTarget.reviewSpaceId);
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

    // レビュー結果を取得
    const reviewResults =
      await this.reviewResultRepository.findByReviewTargetId(reviewTargetIdVo);

    // 失敗項目をカウント
    const failedItemCount = reviewResults.filter(
      (r) => r.errorMessage !== null,
    ).length;

    // スナップショットのチェックリスト内容を取得（重複排除）
    const snapshotContents = new Set(
      reviewResults.map((r) => r.checkListItemContent),
    );
    const snapshotChecklistCount = snapshotContents.size;

    // 現在のチェックリスト項目を取得
    const currentCheckListItems =
      await this.checkListItemRepository.findByReviewSpaceId(
        reviewTarget.reviewSpaceId,
      );
    const currentChecklistCount = currentCheckListItems.length;

    // チェックリストの差分を判定
    const currentContents = new Set(
      currentCheckListItems.map((item) => item.content.value),
    );
    const hasChecklistDiff =
      snapshotChecklistCount !== currentChecklistCount ||
      !areSetsEqual(snapshotContents, currentContents);

    // ドキュメントキャッシュの存在確認
    const documentCaches =
      await this.reviewDocumentCacheRepository.findByReviewTargetId(
        reviewTargetIdVo,
      );
    const hasCachedDocuments = documentCaches.length > 0 &&
      documentCaches.every((cache) => cache.hasCache());

    // リトライ可能かどうかを判定
    const canRetry = reviewTarget.canRetry() && hasCachedDocuments;

    return {
      canRetry,
      reviewType: reviewTarget.reviewType?.value ?? null,
      previousSettings: reviewTarget.reviewSettings?.toDto() ?? null,
      failedItemCount,
      totalItemCount: reviewResults.length,
      hasChecklistDiff,
      snapshotChecklistCount,
      currentChecklistCount,
      hasCachedDocuments,
    };
  }
}

/**
 * 2つのSetが等しいかどうかを判定する
 */
function areSetsEqual(set1: Set<string>, set2: Set<string>): boolean {
  if (set1.size !== set2.size) {
    return false;
  }
  for (const item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }
  return true;
}
