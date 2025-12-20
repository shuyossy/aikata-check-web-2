import { RuntimeContext } from "@mastra/core/di";
import type { AiTaskDto, AiTaskTypeValue } from "@/domain/aiTask";
import { AI_TASK_TYPE } from "@/domain/aiTask";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { ILargeDocumentResultCacheRepository } from "@/application/shared/port/repository/ILargeDocumentResultCacheRepository";
import { ISystemSettingRepository } from "@/application/shared/port/repository/ISystemSettingRepository";
import { IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { ReviewTargetId, ReviewDocumentCache } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { CheckListItem } from "@/domain/checkListItem";
import { createReviewResultSavedCallback } from "@/application/reviewTarget/createReviewResultSavedCallback";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";
import { normalizeUnknownError } from "@/lib/server/error";
import { getLogger } from "@/lib/server/logger";
import {
  mastra,
  checkWorkflowResult,
  FILE_BUFFERS_CONTEXT_KEY,
} from "@/application/mastra";
import type {
  RawUploadFileMeta,
  FileBuffersMap,
  ReviewExecutionWorkflowRuntimeContext,
  ChecklistGenerationWorkflowRuntimeContext,
  SingleReviewResult,
  ExtractedFile,
  ReviewType,
  CachedDocument,
  IndividualDocumentResult,
} from "@/application/mastra";
import { ReviewResultId } from "@/domain/reviewResult";

const logger = getLogger();

/**
 * レビュー実行タスクのペイロード型
 */
export interface ReviewTaskPayload {
  /** レビュー対象ID */
  reviewTargetId: string;
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID */
  userId: string;
  /** ファイルメタデータ */
  files: RawUploadFileMeta[];
  /** チェックリスト項目 */
  checkListItems: Array<{ id: string; content: string }>;
  /** レビュー設定 */
  reviewSettings?: {
    additionalInstructions?: string | null;
    concurrentReviewItems?: number;
    commentFormat?: string | null;
    evaluationCriteria?: Array<{ label: string; description: string }>;
  };
  /** レビュー種別 */
  reviewType: ReviewType;
  /** 復号化済みAPIキー（オプション） */
  decryptedApiKey?: string;
  /** リトライモードフラグ */
  isRetry?: boolean;
  /** リトライ範囲（isRetry=trueの場合のみ） */
  retryScope?: "failed" | "all";
  /** 削除対象のレビュー結果ID一覧（isRetry=trueの場合のみ） */
  resultsToDeleteIds?: string[];
}

/**
 * チェックリスト生成タスクのペイロード型
 */
export interface ChecklistGenerationTaskPayload {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** 実行ユーザーID */
  userId: string;
  /** ファイルメタデータ */
  files: RawUploadFileMeta[];
  /** チェックリスト生成要件 */
  checklistRequirements: string;
  /** 復号化済みAPIキー（オプション） */
  decryptedApiKey?: string;
}

/**
 * タスク実行結果
 */
export interface TaskExecutionResult {
  /** 成功フラグ */
  success: boolean;
  /** エラーメッセージ（失敗時） */
  errorMessage?: string;
}

/**
 * AIタスク実行エンジン
 * キューからデキューされたタスクを実行する
 */
export class AiTaskExecutor {
  constructor(
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly checkListItemRepository: ICheckListItemRepository,
    private readonly reviewDocumentCacheRepository: IReviewDocumentCacheRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly largeDocumentResultCacheRepository: ILargeDocumentResultCacheRepository,
    private readonly systemSettingRepository: ISystemSettingRepository,
    private readonly workflowRunRegistry?: IWorkflowRunRegistry,
  ) {}

  /**
   * タスクを実行する
   * @param task タスクDTO
   * @returns 実行結果
   */
  async execute(task: AiTaskDto): Promise<TaskExecutionResult> {
    const taskType = task.taskType as AiTaskTypeValue;

    logger.info(
      { taskId: task.id, taskType, apiKeyHash: task.apiKeyHash },
      "タスク実行を開始します",
    );

    try {
      // ファイルバッファを読み込む
      const fileBuffers = await this.loadFileBuffers(task);

      switch (taskType) {
        case AI_TASK_TYPE.SMALL_REVIEW:
        case AI_TASK_TYPE.LARGE_REVIEW:
          return await this.executeReviewTask(task, fileBuffers);
        case AI_TASK_TYPE.CHECKLIST_GENERATION:
          return await this.executeChecklistGenerationTask(task, fileBuffers);
        default:
          throw new Error(`Unknown task type: ${taskType}`);
      }
    } catch (error) {
      const normalizedError = normalizeUnknownError(error);
      logger.error(
        { err: normalizedError, taskId: task.id, taskType },
        "タスク実行に失敗しました",
      );
      return {
        success: false,
        errorMessage:
          normalizedError.message || "タスク実行中に予期せぬエラーが発生しました",
      };
    }
  }

  /**
   * RuntimeContextにシステム設定（管理者設定）を追加する
   */
  private async setSystemSettingToRuntimeContext(
    runtimeContext: RuntimeContext<ReviewExecutionWorkflowRuntimeContext> | RuntimeContext<ChecklistGenerationWorkflowRuntimeContext>,
  ): Promise<void> {
    const systemSetting = await this.systemSettingRepository.find();
    if (systemSetting) {
      const dto = systemSetting.toDto();
      // 型アサーションを使用してRuntimeContextに設定
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = runtimeContext as RuntimeContext<any>;
      if (dto.apiKey) {
        ctx.set("systemApiKey", dto.apiKey);
      }
      if (dto.apiUrl) {
        ctx.set("systemApiUrl", dto.apiUrl);
      }
      if (dto.apiModel) {
        ctx.set("systemApiModel", dto.apiModel);
      }
    }
  }

  /**
   * ファイルバッファを読み込む
   */
  private async loadFileBuffers(task: AiTaskDto): Promise<FileBuffersMap> {
    const fileBuffers: FileBuffersMap = new Map();
    const payload = task.payload as unknown as ReviewTaskPayload | ChecklistGenerationTaskPayload;

    for (const fm of task.fileMetadata) {
      // ファイルIDをキーとしてバッファを格納
      // payloadにあるfiles配列のidと対応させる必要がある
      const matchingFile = payload.files.find((f) => f.name === fm.fileName);
      if (!matchingFile) {
        continue;
      }

      // 画像モードの場合は変換済み画像を読み込む
      if (fm.processMode === "image" && fm.convertedImageCount > 0) {
        const convertedImageBuffers = await TaskFileHelper.loadConvertedImages(
          task.id,
          fm.id,
          fm.convertedImageCount,
        );
        fileBuffers.set(matchingFile.id, {
          buffer: Buffer.alloc(0), // 画像モードでは元ファイルは不要
          convertedImageBuffers,
        });
      } else if (fm.filePath) {
        // テキストモード: 元ファイルを読み込む
        const buffer = await TaskFileHelper.loadFile(fm.filePath);
        fileBuffers.set(matchingFile.id, {
          buffer,
        });
      }
    }

    return fileBuffers;
  }

  /**
   * レビュータスクを実行
   */
  private async executeReviewTask(
    task: AiTaskDto,
    fileBuffers: FileBuffersMap,
  ): Promise<TaskExecutionResult> {
    const payload = task.payload as unknown as ReviewTaskPayload;
    const reviewTargetId = ReviewTargetId.reconstruct(payload.reviewTargetId);
    const isRetry = payload.isRetry === true;

    // レビュー対象を取得
    const reviewTarget = await this.reviewTargetRepository.findById(reviewTargetId);
    if (!reviewTarget) {
      return {
        success: false,
        errorMessage: "レビュー対象が見つかりません",
      };
    }

    // リトライの場合、対象レビュー結果を削除
    if (isRetry && payload.resultsToDeleteIds) {
      for (const resultId of payload.resultsToDeleteIds) {
        await this.reviewResultRepository.delete(ReviewResultId.reconstruct(resultId));
      }
      logger.debug(
        { reviewTargetId: payload.reviewTargetId, deletedCount: payload.resultsToDeleteIds.length },
        "リトライ対象のレビュー結果を削除しました",
      );
    }

    // ステータスをreviewingに更新
    const reviewingTarget = reviewTarget.startReviewing();
    await this.reviewTargetRepository.save(reviewingTarget);

    try {
      // RuntimeContextを作成
      const runtimeContext =
        new RuntimeContext<ReviewExecutionWorkflowRuntimeContext>();
      runtimeContext.set("employeeId", payload.userId);
      if (payload.decryptedApiKey) {
        runtimeContext.set("projectApiKey", payload.decryptedApiKey);
      }
      runtimeContext.set("reviewTargetId", payload.reviewTargetId);

      // システム設定（管理者設定）をRuntimeContextに追加
      await this.setSystemSettingToRuntimeContext(runtimeContext);

      // DB保存コールバックを設定
      const onReviewResultSaved = createReviewResultSavedCallback(
        this.reviewResultRepository,
      );
      runtimeContext.set("onReviewResultSaved", onReviewResultSaved);

      // 大量レビュー時の個別結果保存コールバックを設定
      const onIndividualResultsSaved = async (
        individualResults: IndividualDocumentResult[],
        targetId: string,
      ): Promise<void> => {
        if (individualResults.length === 0) return;

        // ドキュメントキャッシュを取得してファイル名からIDをマッピング
        const documentCaches = await this.reviewDocumentCacheRepository.findByReviewTargetId(
          ReviewTargetId.reconstruct(targetId),
        );
        const fileNameToCacheId = new Map<string, string>();
        for (const cache of documentCaches) {
          fileNameToCacheId.set(cache.fileName, cache.id.value);
        }

        // レビュー結果を取得してチェック項目内容からIDをマッピング
        const reviewResults = await this.reviewResultRepository.findByReviewTargetId(
          ReviewTargetId.reconstruct(targetId),
        );
        const contentToResultId = new Map<string, string>();
        for (const result of reviewResults) {
          contentToResultId.set(result.checkListItemContent, result.id.value);
        }

        // 個別結果を保存
        const cacheEntries = [];
        for (const result of individualResults) {
          const reviewDocumentCacheId = fileNameToCacheId.get(result.documentName);
          const reviewResultId = contentToResultId.get(result.checklistItemContent);

          if (reviewDocumentCacheId && reviewResultId) {
            cacheEntries.push({
              reviewDocumentCacheId,
              reviewResultId,
              comment: result.comment,
              totalChunks: result.totalChunks,
              chunkIndex: result.chunkIndex,
              individualFileName: result.documentName,
            });
          } else {
            logger.warn(
              {
                documentName: result.documentName,
                checklistItemContent: result.checklistItemContent,
                hasDocCache: !!reviewDocumentCacheId,
                hasReviewResult: !!reviewResultId,
              },
              "個別結果の保存に必要な関連データが見つかりませんでした",
            );
          }
        }

        if (cacheEntries.length > 0) {
          await this.largeDocumentResultCacheRepository.saveMany(cacheEntries);
          logger.debug(
            { reviewTargetId: targetId, savedCount: cacheEntries.length },
            "大量レビューの個別結果を保存しました",
          );
        }
      };
      runtimeContext.set("onIndividualResultsSaved", onIndividualResultsSaved);

      // リトライモードの場合はキャッシュからドキュメントを読み込む
      if (isRetry) {
        const cachedDocuments = await this.loadCachedDocuments(reviewTargetId);
        if (cachedDocuments.length === 0) {
          const errorTarget = reviewingTarget.markAsError();
          await this.reviewTargetRepository.save(errorTarget);
          return {
            success: false,
            errorMessage: "ドキュメントキャッシュが見つかりません",
          };
        }
        runtimeContext.set("cachedDocuments", cachedDocuments);
        runtimeContext.set("useCachedDocuments", true);
        logger.debug(
          { reviewTargetId: payload.reviewTargetId, cachedCount: cachedDocuments.length },
          "キャッシュモードでレビューを実行します",
        );
      } else {
        // 通常モードの場合はファイルバッファを設定
        runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

        // ドキュメントキャッシュ保存コールバックを設定（初回実行のみ）
        const onExtractedFilesCached = async (
          extractedFiles: ExtractedFile[],
          targetId: string,
        ): Promise<void> => {
          for (const file of extractedFiles) {
            let cachePath: string;
            if (file.processMode === "text") {
              cachePath = await ReviewCacheHelper.saveTextCache(
                targetId,
                file.id,
                file.textContent ?? "",
              );
            } else {
              cachePath = await ReviewCacheHelper.saveImageCache(
                targetId,
                file.id,
                file.imageData ?? [],
              );
            }

            const cache = ReviewDocumentCache.create({
              reviewTargetId: targetId,
              fileName: file.name,
              processMode: file.processMode,
              cachePath,
            });
            await this.reviewDocumentCacheRepository.save(cache);
          }
        };
        runtimeContext.set("onExtractedFilesCached", onExtractedFilesCached);
      }

      // ワークフロー実行
      const workflow = mastra.getWorkflow("reviewExecutionWorkflow");
      const run = await workflow.createRunAsync();

      // ワークフロー実行をレジストリに登録（キャンセル可能にするため）
      if (this.workflowRunRegistry) {
        this.workflowRunRegistry.register(task.id, run);
      }

      let result;
      try {
        result = await run.start({
          inputData: {
            // リトライ時は空の配列（キャッシュモードではfileProcessingStepがスキップされる）
            files: isRetry ? [] : payload.files,
            checkListItems: payload.checkListItems,
            reviewSettings: payload.reviewSettings,
            reviewType: payload.reviewType,
          },
          runtimeContext,
        });
      } finally {
        // ワークフロー実行をレジストリから解除
        if (this.workflowRunRegistry) {
          this.workflowRunRegistry.deregister(task.id);
        }
      }

      // ワークフロー結果の検証
      const checkResult = checkWorkflowResult(result);
      if (checkResult.status !== "success") {
        const errorTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(errorTarget);
        return {
          success: false,
          errorMessage: checkResult.errorMessage || "レビューワークフローに失敗しました",
        };
      }

      if (result.status !== "success") {
        const errorTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(errorTarget);
        return {
          success: false,
          errorMessage: "レビュー結果の取得に失敗しました",
        };
      }

      const workflowResult = result.result as
        | { status: string; reviewResults?: SingleReviewResult[]; errorMessage?: string }
        | undefined;

      if (!workflowResult?.reviewResults || workflowResult.reviewResults.length === 0) {
        const errorTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(errorTarget);
        return {
          success: false,
          errorMessage: "レビュー結果が取得できませんでした",
        };
      }

      // 完了ステータスに更新
      const completedTarget = reviewingTarget.completeReview();
      await this.reviewTargetRepository.save(completedTarget);

      logger.info(
        {
          taskId: task.id,
          reviewTargetId: payload.reviewTargetId,
          resultCount: workflowResult.reviewResults.length,
          isRetry,
        },
        isRetry ? "リトライレビュータスクが正常に完了しました" : "レビュータスクが正常に完了しました",
      );

      return { success: true };
    } catch (error) {
      // エラー時はステータスを更新
      try {
        const errorTarget = reviewingTarget.markAsError();
        await this.reviewTargetRepository.save(errorTarget);
      } catch {
        // ステータス更新失敗は無視
      }
      throw error;
    }
  }

  /**
   * キャッシュからドキュメントを読み込む
   */
  private async loadCachedDocuments(
    reviewTargetId: ReviewTargetId,
  ): Promise<CachedDocument[]> {
    const caches = await this.reviewDocumentCacheRepository.findByReviewTargetId(reviewTargetId);
    const cachedDocuments: CachedDocument[] = [];

    for (const cache of caches) {
      if (!cache.hasCache()) {
        continue;
      }

      if (cache.isTextMode()) {
        const textContent = await ReviewCacheHelper.loadTextCache(cache.cachePath!);
        cachedDocuments.push({
          id: cache.id.value,
          name: cache.fileName,
          type: "text/plain",
          processMode: "text",
          textContent,
        });
      } else {
        const imageData = await ReviewCacheHelper.loadImageCache(cache.cachePath!);
        cachedDocuments.push({
          id: cache.id.value,
          name: cache.fileName,
          type: "application/pdf",
          processMode: "image",
          imageData,
        });
      }
    }

    return cachedDocuments;
  }

  /**
   * チェックリスト生成タスクを実行
   */
  private async executeChecklistGenerationTask(
    task: AiTaskDto,
    fileBuffers: FileBuffersMap,
  ): Promise<TaskExecutionResult> {
    const payload = task.payload as unknown as ChecklistGenerationTaskPayload;
    const reviewSpaceId = ReviewSpaceId.reconstruct(payload.reviewSpaceId);

    // RuntimeContextを作成
    const runtimeContext =
      new RuntimeContext<ChecklistGenerationWorkflowRuntimeContext>();
    runtimeContext.set("employeeId", payload.userId);
    if (payload.decryptedApiKey) {
      runtimeContext.set("projectApiKey", payload.decryptedApiKey);
    }
    runtimeContext.set(FILE_BUFFERS_CONTEXT_KEY, fileBuffers);

    // システム設定（管理者設定）をRuntimeContextに追加
    await this.setSystemSettingToRuntimeContext(runtimeContext);

    // ワークフロー実行
    const workflow = mastra.getWorkflow("checklistGenerationWorkflow");
    const run = await workflow.createRunAsync();

    // ワークフロー実行をレジストリに登録（キャンセル可能にするため）
    if (this.workflowRunRegistry) {
      this.workflowRunRegistry.register(task.id, run);
    }

    let result;
    try {
      result = await run.start({
        inputData: {
          files: payload.files,
          checklistRequirements: payload.checklistRequirements,
        },
        runtimeContext,
      });
    } finally {
      // ワークフロー実行をレジストリから解除
      if (this.workflowRunRegistry) {
        this.workflowRunRegistry.deregister(task.id);
      }
    }

    // ワークフロー結果の検証
    const checkResult = checkWorkflowResult(result);
    if (checkResult.status !== "success") {
      const errorMessage = checkResult.errorMessage || "チェックリスト生成ワークフローに失敗しました";
      // エラーメッセージをレビュースペースに保存
      await this.saveChecklistGenerationError(reviewSpaceId, errorMessage);
      return {
        success: false,
        errorMessage,
      };
    }

    if (result.status !== "success") {
      const errorMessage = "チェックリスト生成結果の取得に失敗しました";
      await this.saveChecklistGenerationError(reviewSpaceId, errorMessage);
      return {
        success: false,
        errorMessage,
      };
    }

    const workflowResult = result.result as
      | { status: string; generatedItems?: string[]; errorMessage?: string }
      | undefined;

    if (!workflowResult?.generatedItems || workflowResult.generatedItems.length === 0) {
      const errorMessage = "チェックリストが生成されませんでした";
      await this.saveChecklistGenerationError(reviewSpaceId, errorMessage);
      return {
        success: false,
        errorMessage,
      };
    }

    // チェック項目をDBに保存
    const items = workflowResult.generatedItems.map((content) =>
      CheckListItem.create({
        reviewSpaceId: payload.reviewSpaceId,
        content,
      }),
    );
    await this.checkListItemRepository.bulkInsert(items);

    // 成功時はエラーメッセージをクリア
    await this.clearChecklistGenerationError(reviewSpaceId);

    logger.info(
      {
        taskId: task.id,
        reviewSpaceId: payload.reviewSpaceId,
        generatedCount: items.length,
      },
      "チェックリスト生成タスクが正常に完了しました",
    );

    return { success: true };
  }

  /**
   * チェックリスト生成エラーを保存
   */
  private async saveChecklistGenerationError(
    reviewSpaceId: ReviewSpaceId,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.reviewSpaceRepository.updateChecklistGenerationError(
        reviewSpaceId,
        errorMessage,
      );
      logger.debug(
        { reviewSpaceId: reviewSpaceId.value, errorMessage },
        "チェックリスト生成エラーをレビュースペースに保存しました",
      );
    } catch (error) {
      logger.warn(
        { err: normalizeUnknownError(error), reviewSpaceId: reviewSpaceId.value },
        "チェックリスト生成エラーの保存に失敗しました",
      );
    }
  }

  /**
   * チェックリスト生成エラーをクリア
   */
  private async clearChecklistGenerationError(
    reviewSpaceId: ReviewSpaceId,
  ): Promise<void> {
    try {
      await this.reviewSpaceRepository.updateChecklistGenerationError(
        reviewSpaceId,
        null,
      );
      logger.debug(
        { reviewSpaceId: reviewSpaceId.value },
        "チェックリスト生成エラーをクリアしました",
      );
    } catch (error) {
      logger.warn(
        { err: normalizeUnknownError(error), reviewSpaceId: reviewSpaceId.value },
        "チェックリスト生成エラーのクリアに失敗しました",
      );
    }
  }
}
