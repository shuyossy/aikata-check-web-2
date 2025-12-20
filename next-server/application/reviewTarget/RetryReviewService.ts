import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository, IReviewDocumentCacheRepository, ISystemSettingRepository } from "@/application/shared/port/repository";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import { getAiTaskBootstrap } from "@/application/aiTask";
import { ReviewTargetId, ReviewType } from "@/domain/reviewTarget";
import { ProjectId } from "@/domain/project";
import { AI_TASK_TYPE } from "@/domain/aiTask";
import { domainValidationError, internalError } from "@/lib/server/error";
import type { ReviewSettingsCommand } from "./ExecuteReviewService";
import type { ReviewTaskPayload } from "@/application/aiTask/AiTaskExecutor";
import type { ReviewType as WorkflowReviewType } from "@/application/mastra";

/**
 * リトライ範囲
 */
export type RetryScope = "failed" | "all";

/**
 * リトライレビューコマンド（入力DTO）
 */
export interface RetryReviewCommand {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** 実行ユーザーID（権限確認用） */
  userId: string;
  /** リトライ範囲 */
  retryScope: RetryScope;
  /** 最新チェックリストを使用するか（retryScope === 'all'の場合のみ有効） */
  useLatestChecklist?: boolean;
  /** レビュー種別（編集可能） */
  reviewType?: WorkflowReviewType;
  /** レビュー設定（編集可能） */
  reviewSettings?: ReviewSettingsCommand;
}

/**
 * リトライレビュー結果DTO（キュー登録版）
 */
export interface RetryReviewResult {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** ステータス（queued） */
  status: string;
  /** キュー長 */
  queueLength: number;
  /** リトライ項目数 */
  retryItems: number;
}

/**
 * リトライレビュー実行サービス
 * 既存のレビュー対象に対してリトライレビューを実行する（キュー登録版）
 */
export class RetryReviewService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly reviewDocumentCacheRepository: IReviewDocumentCacheRepository,
    private readonly systemSettingRepository: ISystemSettingRepository,
    private readonly aiTaskQueueService: AiTaskQueueService,
  ) {}

  /**
   * リトライレビュー実行（キューに登録）
   * @param command 実行コマンド
   * @returns キュー登録結果
   */
  async execute(command: RetryReviewCommand): Promise<RetryReviewResult> {
    const {
      reviewTargetId,
      userId,
      retryScope,
      useLatestChecklist = false,
      reviewType,
      reviewSettings,
    } = command;

    // レビュー対象の存在確認
    const reviewTargetIdVo = ReviewTargetId.reconstruct(reviewTargetId);
    const reviewTarget = await this.reviewTargetRepository.findById(reviewTargetIdVo);
    if (!reviewTarget) {
      throw domainValidationError("REVIEW_TARGET_NOT_FOUND");
    }

    // リトライ可能か確認
    if (!reviewTarget.canRetry()) {
      throw domainValidationError("RETRY_NOT_AVAILABLE");
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

    // ドキュメントキャッシュの存在確認
    const documentCaches = await this.reviewDocumentCacheRepository.findByReviewTargetId(reviewTargetIdVo);
    if (documentCaches.length === 0) {
      throw domainValidationError("RETRY_NO_CACHE");
    }

    // キャッシュが全て存在するか確認
    const allCachesExist = documentCaches.every((cache) => cache.hasCache());
    if (!allCachesExist) {
      throw domainValidationError("RETRY_NO_CACHE");
    }

    // 既存のレビュー結果を取得
    const existingResults = await this.reviewResultRepository.findByReviewTargetId(reviewTargetIdVo);

    // 対象チェックリストと削除対象結果を決定
    let targetCheckListItems: Array<{ id: string; content: string }>;
    let resultsToDeleteIds: string[];

    if (retryScope === "failed") {
      // 失敗項目のみリトライ
      const failedResults = existingResults.filter((r) => r.errorMessage !== null);
      targetCheckListItems = failedResults.map((r, idx) => ({
        id: `retry-${idx}`,
        content: r.checkListItemContent,
      }));
      resultsToDeleteIds = failedResults.map((r) => r.id.value);
    } else {
      // 全項目リトライ
      if (useLatestChecklist) {
        // 最新のチェックリストを使用
        const currentCheckListItems = await this.checkListItemRepository.findByReviewSpaceId(
          reviewTarget.reviewSpaceId,
        );
        targetCheckListItems = currentCheckListItems.map((item) => ({
          id: item.id.value,
          content: item.content.value,
        }));
      } else {
        // 前回のチェックリスト（スナップショット）を使用
        const uniqueContents = new Set(existingResults.map((r) => r.checkListItemContent));
        targetCheckListItems = Array.from(uniqueContents).map((content, idx) => ({
          id: `snapshot-${idx}`,
          content,
        }));
      }
      resultsToDeleteIds = existingResults.map((r) => r.id.value);
    }

    if (targetCheckListItems.length === 0) {
      throw internalError({
        expose: true,
        messageCode: "RETRY_NO_ITEMS",
      });
    }

    // レビュー種別を決定
    const effectiveReviewType = reviewType ?? reviewTarget.reviewType?.value ?? "small";

    // レビュー設定を決定（コマンドで指定がなければ前回の設定を使用）
    const effectiveSettings = reviewSettings ?? reviewTarget.reviewSettings?.toDto() ?? null;

    // APIキーを取得（プロジェクト設定 > 管理者設定 > 環境変数）
    const decryptedApiKey = project.encryptedApiKey?.decrypt();
    const systemSetting = await this.systemSettingRepository.find();
    const systemApiKey = systemSetting?.toDto().apiKey;
    const apiKey = decryptedApiKey ?? systemApiKey ?? process.env.AI_API_KEY;
    if (!apiKey) {
      throw internalError({
        expose: true,
        messageCode: "AI_TASK_NO_API_KEY",
      });
    }

    // ステータスをqueuedに更新
    let updatedTarget = reviewTarget.prepareForRetry();

    // レビュー種別が変更されていれば更新
    if (reviewType) {
      updatedTarget = updatedTarget.withReviewType(ReviewType.create(reviewType));
    }

    // レビュー設定が変更されていれば更新
    if (reviewSettings) {
      const { ReviewSettings } = await import("@/domain/reviewSpace");
      const baseSettings = reviewTarget.reviewSettings?.toDto();
      const newSettings = ReviewSettings.create({
        additionalInstructions: reviewSettings.additionalInstructions ?? baseSettings?.additionalInstructions ?? null,
        concurrentReviewItems: reviewSettings.concurrentReviewItems ?? baseSettings?.concurrentReviewItems,
        commentFormat: reviewSettings.commentFormat ?? baseSettings?.commentFormat ?? null,
        evaluationCriteria: reviewSettings.evaluationCriteria ?? baseSettings?.evaluationCriteria,
      });
      updatedTarget = updatedTarget.withUpdatedSettings(newSettings);
    }

    await this.reviewTargetRepository.save(updatedTarget);

    // タスクタイプを決定
    const taskType =
      effectiveReviewType === "large"
        ? AI_TASK_TYPE.LARGE_REVIEW
        : AI_TASK_TYPE.SMALL_REVIEW;

    // ペイロードを作成
    const payload: ReviewTaskPayload = {
      reviewTargetId,
      reviewSpaceId: reviewTarget.reviewSpaceId.value,
      userId,
      files: [], // リトライ時はファイルは不要（キャッシュを使用）
      checkListItems: targetCheckListItems,
      reviewSettings: effectiveSettings
        ? {
            additionalInstructions: effectiveSettings.additionalInstructions ?? null,
            concurrentReviewItems: effectiveSettings.concurrentReviewItems,
            commentFormat: effectiveSettings.commentFormat ?? null,
            evaluationCriteria: effectiveSettings.evaluationCriteria,
          }
        : undefined,
      reviewType: effectiveReviewType as "small" | "large",
      decryptedApiKey: decryptedApiKey ?? undefined,
      // リトライ用フラグ
      isRetry: true,
      retryScope,
      resultsToDeleteIds,
    };

    // キューに登録（ファイルは不要）
    const enqueueResult = await this.aiTaskQueueService.enqueueTask({
      taskType,
      apiKey,
      payload: payload as unknown as Record<string, unknown>,
      files: [], // リトライ時はファイルアップロード不要
    });

    // ワーカーを起動
    const aiTaskBootstrap = getAiTaskBootstrap();
    await aiTaskBootstrap.startWorkersForApiKeyHash(enqueueResult.apiKeyHash);

    return {
      reviewTargetId: updatedTarget.id.value,
      status: "queued",
      queueLength: enqueueResult.queueLength,
      retryItems: targetCheckListItems.length,
    };
  }
}
