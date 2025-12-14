import { RuntimeContext } from "@mastra/core/di";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository, IReviewDocumentCacheRepository } from "@/application/shared/port/repository";
import { ReviewTarget, ReviewTargetId, ReviewType } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";
import { createReviewResultSavedCallback } from "./createReviewResultSavedCallback";
import { ProjectId } from "@/domain/project";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";
import {
  AppError,
  domainValidationError,
  internalError,
  normalizeUnknownError,
} from "@/lib/server/error";
import { mastra, checkWorkflowResult } from "@/application/mastra";
import type {
  ReviewExecutionWorkflowRuntimeContext,
  EvaluationCriterion,
  SingleReviewResult,
  CachedDocument,
  ReviewType as WorkflowReviewType,
} from "@/application/mastra";
import { ReviewSettingsCommand } from "./ExecuteReviewService";

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
 * リトライレビュー結果DTO
 */
export interface RetryReviewResult {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** ステータス */
  status: string;
  /** 全項目数 */
  totalItems: number;
  /** リトライ項目数 */
  retryItems: number;
  /** レビュー結果の配列 */
  reviewResults: Array<{
    checkListItemContent: string;
    evaluation: string | null;
    comment: string | null;
    errorMessage: string | null;
  }>;
}

/**
 * リトライレビュー実行サービス
 * 既存のレビュー対象に対してリトライレビューを実行する
 */
export class RetryReviewService {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly reviewDocumentCacheRepository: IReviewDocumentCacheRepository,
  ) {}

  /**
   * リトライレビュー実行
   * @param command 実行コマンド
   * @returns リトライレビュー結果
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

    // 対象チェックリストを決定
    let targetCheckListItems: Array<{ id: string; content: string }>;
    let resultsToDelete: ReviewResult[];

    if (retryScope === "failed") {
      // 失敗項目のみリトライ
      const failedResults = existingResults.filter((r) => r.errorMessage !== null);
      targetCheckListItems = failedResults.map((r, idx) => ({
        id: `retry-${idx}`, // リトライ用の仮ID
        content: r.checkListItemContent,
      }));
      resultsToDelete = failedResults;
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
        // review_resultsから重複を排除して取得
        const uniqueContents = new Set(existingResults.map((r) => r.checkListItemContent));
        targetCheckListItems = Array.from(uniqueContents).map((content, idx) => ({
          id: `snapshot-${idx}`,
          content,
        }));
      }
      resultsToDelete = existingResults; // 全削除
    }

    if (targetCheckListItems.length === 0) {
      throw internalError({
        expose: true,
        messageCode: "RETRY_NO_ITEMS",
      });
    }

    // ドキュメントキャッシュをロード（CachedDocument形式）
    const cachedDocuments: CachedDocument[] = [];
    for (const cache of documentCaches) {
      if (cache.isTextMode()) {
        const textContent = await ReviewCacheHelper.loadTextCache(cache.cachePath!);
        cachedDocuments.push({
          id: cache.id.value,
          name: cache.fileName,
          type: "text/plain", // キャッシュには元のMIMEタイプは保存していないので仮の値
          processMode: "text",
          textContent,
        });
      } else {
        const imageData = await ReviewCacheHelper.loadImageCache(cache.cachePath!);
        cachedDocuments.push({
          id: cache.id.value,
          name: cache.fileName,
          type: "application/pdf", // 画像モードはPDFから変換されたものと仮定
          processMode: "image",
          imageData,
        });
      }
    }

    // レビュー種別を決定
    const effectiveReviewType = reviewType ?? reviewTarget.reviewType?.value ?? "small";

    // レビュー設定を決定（コマンドで指定がなければ前回の設定を使用）
    const effectiveSettings = reviewSettings ?? reviewTarget.reviewSettings?.toDto() ?? null;

    // ステータスをreviewingに更新
    let updatedTarget = reviewTarget.prepareForRetry();

    // レビュー種別が変更されていれば更新
    if (reviewType) {
      updatedTarget = updatedTarget.withReviewType(ReviewType.create(reviewType));
    }

    // レビュー設定が変更されていれば更新
    if (reviewSettings) {
      // 新しいレビュー設定を作成（前回の設定をベースに更新）
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

    // 対象レビュー結果を削除
    for (const result of resultsToDelete) {
      await this.reviewResultRepository.delete(result.id);
    }

    // ワークフロー実行
    let workflowResults: SingleReviewResult[];
    let finalTarget: ReviewTarget;

    try {
      // TODO: Phase 5でキャッシュ利用ワークフローを追加後、"reviewExecutionWorkflowWithCache"に変更
      const workflow = mastra.getWorkflow("reviewExecutionWorkflow");
      const run = await workflow.createRunAsync();

      // RuntimeContextを作成
      const runtimeContext = new RuntimeContext<ReviewExecutionWorkflowRuntimeContext>();
      runtimeContext.set("employeeId", userId);
      const decryptedApiKey = project.encryptedApiKey?.decrypt();
      if (decryptedApiKey) {
        runtimeContext.set("projectApiKey", decryptedApiKey);
      }

      // レビュー対象IDを設定
      runtimeContext.set("reviewTargetId", reviewTargetId);

      // DB保存コールバックを設定
      const onReviewResultSaved = createReviewResultSavedCallback(
        this.reviewResultRepository,
      );
      runtimeContext.set("onReviewResultSaved", onReviewResultSaved);

      // キャッシュモードとして実行: ワークフロー内でファイル処理ステップがスキップされる
      runtimeContext.set("cachedDocuments", cachedDocuments);
      runtimeContext.set("useCachedDocuments", true);

      // キャッシュモード時は空のfilesを渡す（fileProcessingStepはスキップされる）
      const result = await run.start({
        inputData: {
          files: [], // キャッシュモード時は空で渡す
          checkListItems: targetCheckListItems,
          reviewSettings: effectiveSettings
            ? {
                additionalInstructions: effectiveSettings.additionalInstructions ?? null,
                concurrentReviewItems: effectiveSettings.concurrentReviewItems,
                commentFormat: effectiveSettings.commentFormat ?? null,
                evaluationCriteria: effectiveSettings.evaluationCriteria as EvaluationCriterion[] | undefined,
              }
            : undefined,
          reviewType: effectiveReviewType as "small" | "large",
        },
        runtimeContext,
      });

      // ワークフロー結果の検証
      const checkResult = checkWorkflowResult(result);
      if (checkResult.status !== "success") {
        finalTarget = updatedTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
        throw internalError({
          expose: true,
          messageCode: "REVIEW_EXECUTION_FAILED",
          messageParams: {
            detail: checkResult.errorMessage || "ワークフロー実行に失敗しました",
          },
        });
      }

      // ワークフロー結果からレビュー結果を取得
      if (result.status !== "success") {
        finalTarget = updatedTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
        throw internalError({
          expose: true,
          messageCode: "REVIEW_EXECUTION_FAILED",
          messageParams: { detail: "ワークフロー結果の取得に失敗しました" },
        });
      }

      const workflowResult = result.result as
        | {
            status: string;
            reviewResults?: SingleReviewResult[];
            errorMessage?: string;
          }
        | undefined;

      if (
        !workflowResult?.reviewResults ||
        workflowResult.reviewResults.length === 0
      ) {
        finalTarget = updatedTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
        throw internalError({
          expose: true,
          messageCode: "REVIEW_EXECUTION_FAILED",
          messageParams: { detail: "レビュー結果が取得できませんでした" },
        });
      }

      workflowResults = workflowResult.reviewResults;

      // ワークフロー成功時は完了ステータスに更新
      finalTarget = updatedTarget.completeReview();
      await this.reviewTargetRepository.save(finalTarget);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const normalizedError = normalizeUnknownError(error);
      try {
        finalTarget = updatedTarget.markAsError();
        await this.reviewTargetRepository.save(finalTarget);
      } catch {
        // ステータス更新失敗は無視
      }
      throw normalizedError;
    }

    // リトライしなかった項目の結果を含めた全体の結果を取得
    const allResults = await this.reviewResultRepository.findByReviewTargetId(reviewTargetIdVo);

    return {
      reviewTargetId: finalTarget.id.value,
      status: finalTarget.status.value,
      totalItems: allResults.length,
      retryItems: targetCheckListItems.length,
      reviewResults: workflowResults.map((r) => ({
        checkListItemContent: r.checkListItemContent,
        evaluation: r.evaluation,
        comment: r.comment,
        errorMessage: r.errorMessage,
      })),
    };
  }
}
