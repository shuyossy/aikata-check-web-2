import { AiTaskQueueService } from "./AiTaskQueueService";
import { AiTaskExecutor } from "./AiTaskExecutor";
import { type IWorkflowRunRegistry } from "./WorkflowRunRegistry";
import { getLogger } from "@/lib/server/logger";

const logger = getLogger();

/**
 * ポーリング間隔を取得（ミリ秒）
 * 環境変数AI_QUEUE_POLLING_INTERVAL_MSで設定可能（デフォルト: 10000ms）
 */
const getPollingIntervalMs = (): number => {
  const interval = parseInt(
    process.env.AI_QUEUE_POLLING_INTERVAL_MS || "10000",
    10,
  );
  return isNaN(interval) || interval < 1000 ? 10000 : interval;
};

/**
 * AIタスクワーカー
 * 特定のAPIキーハッシュに対してキューをポーリングし、タスクを実行する
 */
export class AiTaskWorker {
  private _isRunning: boolean = false;
  private _shouldStop: boolean = false;
  private _currentTaskId: string | null = null;
  private _loopPromise: Promise<void> | null = null;

  constructor(
    private readonly apiKeyHash: string,
    private readonly queueService: AiTaskQueueService,
    private readonly executor: AiTaskExecutor,
    private readonly workerId: string,
    private readonly workflowRunRegistry?: IWorkflowRunRegistry,
  ) {}

  /**
   * ワーカーが実行中かどうか
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * 現在処理中のタスクID
   */
  get currentTaskId(): string | null {
    return this._currentTaskId;
  }

  /**
   * ワーカーを開始する
   * ポーリングループを開始し、タスクを取得・実行する
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      logger.warn(
        { workerId: this.workerId, apiKeyHash: this.apiKeyHash },
        "ワーカーは既に実行中です",
      );
      return;
    }

    this._isRunning = true;
    this._shouldStop = false;

    logger.info(
      { workerId: this.workerId, apiKeyHash: this.apiKeyHash },
      "ワーカーを開始します",
    );

    // ポーリングループを開始
    this._loopPromise = this.runLoop();
  }

  /**
   * ワーカーを停止する
   * 現在のタスクが完了するまで待機
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    logger.info(
      { workerId: this.workerId, apiKeyHash: this.apiKeyHash },
      "ワーカーを停止します",
    );

    this._shouldStop = true;

    // ループの完了を待機
    if (this._loopPromise) {
      await this._loopPromise;
    }

    this._isRunning = false;
    this._loopPromise = null;

    logger.info(
      { workerId: this.workerId, apiKeyHash: this.apiKeyHash },
      "ワーカーが停止しました",
    );
  }

  /**
   * ポーリングループ
   */
  private async runLoop(): Promise<void> {
    const pollingInterval = getPollingIntervalMs();

    while (!this._shouldStop) {
      try {
        // キャンセル処理中の場合はデキューをスキップして待機
        if (this.workflowRunRegistry?.isCancelling()) {
          logger.debug(
            { workerId: this.workerId, apiKeyHash: this.apiKeyHash },
            "キャンセル処理中のためデキューをスキップします",
          );
          await this.sleep(pollingInterval);
          continue;
        }

        // キューからタスクを取得（処理中に遷移）
        const task = await this.queueService.dequeueTask(this.apiKeyHash);

        if (task) {
          this._currentTaskId = task.id;

          logger.info(
            {
              workerId: this.workerId,
              taskId: task.id,
              taskType: task.taskType,
            },
            "タスクを実行開始します",
          );

          // タスクを実行
          const result = await this.executor.execute(task);

          if (result.success) {
            // タスク完了
            await this.queueService.completeTask({ taskId: task.id });
            logger.info(
              { workerId: this.workerId, taskId: task.id },
              "タスクが正常に完了しました",
            );
          } else {
            // タスク失敗
            await this.queueService.failTask({
              taskId: task.id,
              errorMessage: result.errorMessage || "Unknown error",
            });
            logger.error(
              {
                workerId: this.workerId,
                taskId: task.id,
                errorMessage: result.errorMessage,
              },
              "タスクが失敗しました",
            );
          }

          this._currentTaskId = null;
        } else {
          // キューが空の場合はポーリング間隔まで待機
          await this.sleep(pollingInterval);
        }
      } catch (error) {
        logger.error(
          { err: error, workerId: this.workerId, apiKeyHash: this.apiKeyHash },
          "ワーカーループ中にエラーが発生しました",
        );

        // 現在処理中のタスクがあれば失敗としてマーク
        if (this._currentTaskId) {
          try {
            await this.queueService.failTask({
              taskId: this._currentTaskId,
              errorMessage:
                error instanceof Error ? error.message : "ワーカーループエラー",
            });
          } catch (failError) {
            logger.error(
              { err: failError, taskId: this._currentTaskId },
              "タスク失敗マーク中にエラーが発生しました",
            );
          }
          this._currentTaskId = null;
        }

        // エラー後は短い待機を入れてから再試行
        await this.sleep(5000);
      }
    }
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
