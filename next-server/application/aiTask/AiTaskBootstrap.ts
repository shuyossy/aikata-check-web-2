import { AiTaskQueueService } from "./AiTaskQueueService";
import { AiTaskWorkerPool } from "./AiTaskWorkerPool";
import {
  AiTaskExecutor,
  type ReviewTaskPayload,
  type ChecklistGenerationTaskPayload,
} from "./AiTaskExecutor";
import {
  AiTaskRepository,
  AiTaskFileMetadataRepository,
} from "@/infrastructure/adapter/db/drizzle/repository";
import {
  ReviewTargetRepository,
  ReviewResultRepository,
  CheckListItemRepository,
  ReviewDocumentCacheRepository,
  ReviewSpaceRepository,
  LargeDocumentResultCacheRepository,
} from "@/infrastructure/adapter/db/drizzle/repository";
import { AI_TASK_STATUS, AI_TASK_TYPE } from "@/domain/aiTask";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { getLogger } from "@/lib/server/logger";

const logger = getLogger();

/**
 * AIタスクキューのブートストラップ
 * サーバ起動時の初期化とシャットダウン処理を管理
 */
export class AiTaskBootstrap {
  private static instance: AiTaskBootstrap | null = null;
  private workerPool: AiTaskWorkerPool | null = null;
  private queueService: AiTaskQueueService | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): AiTaskBootstrap {
    if (!AiTaskBootstrap.instance) {
      AiTaskBootstrap.instance = new AiTaskBootstrap();
    }
    return AiTaskBootstrap.instance;
  }

  /**
   * 初期化を実行
   * 1. 処理中のタスクを失敗としてマーク
   * 2. キューにあるタスクのAPIキーハッシュを取得してワーカーを開始
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("AIタスクブートストラップは既に初期化されています");
      return;
    }

    logger.info("AIタスクブートストラップを初期化します");

    try {
      // ファイルベースディレクトリの確認
      await TaskFileHelper.ensureBaseDir();

      // リポジトリの作成
      const aiTaskRepository = new AiTaskRepository();
      const aiTaskFileMetadataRepository = new AiTaskFileMetadataRepository();
      const reviewTargetRepository = new ReviewTargetRepository();
      const reviewResultRepository = new ReviewResultRepository();
      const checkListItemRepository = new CheckListItemRepository();
      const reviewDocumentCacheRepository = new ReviewDocumentCacheRepository();
      const reviewSpaceRepository = new ReviewSpaceRepository();
      const largeDocumentResultCacheRepository =
        new LargeDocumentResultCacheRepository();

      // サービスの作成
      this.queueService = new AiTaskQueueService(
        aiTaskRepository,
        aiTaskFileMetadataRepository,
      );

      const executor = new AiTaskExecutor(
        reviewTargetRepository,
        reviewResultRepository,
        checkListItemRepository,
        reviewDocumentCacheRepository,
        reviewSpaceRepository,
        largeDocumentResultCacheRepository,
      );

      this.workerPool = new AiTaskWorkerPool(this.queueService, executor);

      // 処理中のタスクを復元（失敗としてマーク）
      await this.recoverStuckTasks(
        aiTaskRepository,
        reviewTargetRepository,
        reviewSpaceRepository,
      );

      // キューにあるタスクのAPIキーハッシュを取得してワーカーを開始
      const apiKeyHashes =
        await this.queueService.findDistinctApiKeyHashesInQueue();

      logger.info(
        { apiKeyHashCount: apiKeyHashes.length },
        "キュー内のAPIキーハッシュを検出しました",
      );

      for (const apiKeyHash of apiKeyHashes) {
        await this.workerPool.startWorkers(apiKeyHash);
      }

      this.isInitialized = true;
      logger.info("AIタスクブートストラップの初期化が完了しました");
    } catch (error) {
      logger.error(
        { err: error },
        "AIタスクブートストラップの初期化に失敗しました",
      );
      throw error;
    }
  }

  /**
   * 処理中で止まっていたタスクを復元
   * システム再起動時に処理中だったタスクは失敗として扱う
   * 関連するエンティティ（review_targets, review_spaces）のステータスも更新する
   */
  private async recoverStuckTasks(
    aiTaskRepository: AiTaskRepository,
    reviewTargetRepository: ReviewTargetRepository,
    reviewSpaceRepository: ReviewSpaceRepository,
  ): Promise<void> {
    const processingTasks = await aiTaskRepository.findByStatus(
      AI_TASK_STATUS.PROCESSING,
    );

    if (processingTasks.length === 0) {
      logger.info("復元対象の処理中タスクはありません");
      return;
    }

    logger.info(
      { count: processingTasks.length },
      "処理中のタスクを失敗としてマークします",
    );

    const errorMessage = "システム再起動により処理が中断されました";

    for (const task of processingTasks) {
      try {
        // タスクを失敗としてマーク
        const failedTask = task.failWithError(errorMessage);

        // DBを更新（その後すぐ削除されるが、ログ目的で一旦保存）
        await aiTaskRepository.save(failedTask);

        // タスク種別に応じて関連エンティティのステータスを更新
        await this.updateRelatedEntityStatus(
          task.taskType.value,
          task.payload,
          reviewTargetRepository,
          reviewSpaceRepository,
          errorMessage,
        );

        // ファイルを削除
        await TaskFileHelper.deleteTaskFiles(task.id.value);

        // DBからタスクを削除
        await aiTaskRepository.delete(task.id);

        logger.warn(
          { taskId: task.id.value, taskType: task.taskType.value },
          "処理中タスクを失敗としてマークし、削除しました",
        );
      } catch (error) {
        logger.error(
          { err: error, taskId: task.id.value },
          "タスク復元処理中にエラーが発生しました",
        );
      }
    }
  }

  /**
   * タスク種別に応じて関連エンティティのステータスを更新
   */
  private async updateRelatedEntityStatus(
    taskType: string,
    payload: unknown,
    reviewTargetRepository: ReviewTargetRepository,
    reviewSpaceRepository: ReviewSpaceRepository,
    errorMessage: string,
  ): Promise<void> {
    if (
      taskType === AI_TASK_TYPE.SMALL_REVIEW ||
      taskType === AI_TASK_TYPE.LARGE_REVIEW
    ) {
      // レビュータスクの場合: review_targetsをerrorに更新
      const reviewPayload = payload as ReviewTaskPayload;
      const reviewTargetId = reviewPayload.reviewTargetId;

      try {
        const reviewTarget = await reviewTargetRepository.findById(
          ReviewTargetId.reconstruct(reviewTargetId),
        );

        if (reviewTarget) {
          const errorTarget = reviewTarget.markAsError();
          await reviewTargetRepository.save(errorTarget);
          logger.info(
            { reviewTargetId },
            "レビュー対象のステータスをerrorに更新しました",
          );
        } else {
          logger.warn({ reviewTargetId }, "レビュー対象が見つかりませんでした");
        }
      } catch (error) {
        logger.error(
          { err: error, reviewTargetId },
          "レビュー対象のステータス更新に失敗しました",
        );
      }
    } else if (taskType === AI_TASK_TYPE.CHECKLIST_GENERATION) {
      // チェックリスト生成タスクの場合: checklistGenerationErrorを保存
      const checklistPayload = payload as ChecklistGenerationTaskPayload;
      const reviewSpaceId = checklistPayload.reviewSpaceId;

      try {
        await reviewSpaceRepository.updateChecklistGenerationError(
          ReviewSpaceId.reconstruct(reviewSpaceId),
          errorMessage,
        );
        logger.info(
          { reviewSpaceId },
          "チェックリスト生成エラーを保存しました",
        );
      } catch (error) {
        logger.error(
          { err: error, reviewSpaceId },
          "チェックリスト生成エラーの保存に失敗しました",
        );
      }
    }
  }

  /**
   * シャットダウンを実行
   * 全ワーカーを停止
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info("AIタスクブートストラップをシャットダウンします");

    try {
      if (this.workerPool) {
        await this.workerPool.stopAllWorkers();
      }

      this.isInitialized = false;
      logger.info("AIタスクブートストラップのシャットダウンが完了しました");
    } catch (error) {
      logger.error(
        { err: error },
        "AIタスクブートストラップのシャットダウン中にエラーが発生しました",
      );
      throw error;
    }
  }

  /**
   * ワーカープールを取得
   */
  getWorkerPool(): AiTaskWorkerPool | null {
    return this.workerPool;
  }

  /**
   * キューサービスを取得
   */
  getQueueService(): AiTaskQueueService | null {
    return this.queueService;
  }

  /**
   * 初期化済みかどうか
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 新しいAPIキーハッシュのワーカーを開始
   * タスク登録時に呼び出される
   * 未初期化の場合は自動的に初期化を行う（遅延初期化）
   */
  async startWorkersForApiKeyHash(apiKeyHash: string): Promise<void> {
    // 未初期化の場合は初期化を実行（遅延初期化）
    // Next.jsのモジュールキャッシュの影響で、instrumentation.tsで初期化した
    // インスタンスとServer Actionsから参照するインスタンスが異なる場合があるため
    if (!this.isInitialized) {
      logger.info("AiTaskBootstrapが未初期化のため、初期化を実行します");
      await this.initialize();
    }

    if (!this.workerPool) {
      logger.error("初期化後もワーカープールがnullです");
      return;
    }

    if (!this.workerPool.hasWorkers(apiKeyHash)) {
      await this.workerPool.startWorkers(apiKeyHash);
    }
  }
}

/**
 * ブートストラップインスタンスを取得するヘルパー関数
 */
export function getAiTaskBootstrap(): AiTaskBootstrap {
  return AiTaskBootstrap.getInstance();
}
