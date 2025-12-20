import { AiTaskQueueService } from "./AiTaskQueueService";
import { AiTaskWorkerPool } from "./AiTaskWorkerPool";
import { AiTaskExecutor } from "./AiTaskExecutor";
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
  SystemSettingRepository,
} from "@/infrastructure/adapter/db/drizzle/repository";
import { AI_TASK_STATUS, AiTaskId } from "@/domain/aiTask";
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
      const largeDocumentResultCacheRepository = new LargeDocumentResultCacheRepository();
      const systemSettingRepository = new SystemSettingRepository();

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
        systemSettingRepository,
      );

      this.workerPool = new AiTaskWorkerPool(this.queueService, executor);

      // 処理中のタスクを復元（失敗としてマーク）
      await this.recoverStuckTasks(aiTaskRepository);

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
   */
  private async recoverStuckTasks(
    aiTaskRepository: AiTaskRepository,
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

    for (const task of processingTasks) {
      try {
        // タスクを失敗としてマーク
        const failedTask = task.failWithError(
          "システム再起動により処理が中断されました",
        );

        // DBを更新（その後すぐ削除されるが、ログ目的で一旦保存）
        await aiTaskRepository.save(failedTask);

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
