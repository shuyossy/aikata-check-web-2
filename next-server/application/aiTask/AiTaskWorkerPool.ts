import { AiTaskWorker } from "./AiTaskWorker";
import { AiTaskQueueService } from "./AiTaskQueueService";
import { AiTaskExecutor } from "./AiTaskExecutor";
import { getLogger } from "@/lib/server/logger";
import { v4 as uuidv4 } from "uuid";

const logger = getLogger();

/**
 * 並列実行数を取得
 * 環境変数AI_QUEUE_CONCURRENCYで設定可能（デフォルト: 1）
 */
const getConcurrency = (): number => {
  const concurrency = parseInt(process.env.AI_QUEUE_CONCURRENCY || "1", 10);
  return isNaN(concurrency) || concurrency < 1 ? 1 : concurrency;
};

/**
 * AIタスクワーカープール
 * APIキーハッシュごとにワーカーを管理し、並列実行数を制御する
 */
export class AiTaskWorkerPool {
  /** APIキーハッシュごとのワーカー配列 */
  private workers: Map<string, AiTaskWorker[]> = new Map();

  constructor(
    private readonly queueService: AiTaskQueueService,
    private readonly executor: AiTaskExecutor,
  ) {}

  /**
   * 指定したAPIキーハッシュのワーカーを開始する
   * @param apiKeyHash APIキーハッシュ
   */
  async startWorkers(apiKeyHash: string): Promise<void> {
    const existingWorkers = this.workers.get(apiKeyHash);

    // 既存ワーカーがある場合、停止済みのものをクリーンアップ
    if (existingWorkers && existingWorkers.length > 0) {
      const runningWorkers = existingWorkers.filter((w) => w.isRunning);

      if (runningWorkers.length > 0) {
        logger.warn(
          { apiKeyHash, existingCount: runningWorkers.length },
          "ワーカーは既に開始されています",
        );
        return;
      }

      // 全て停止済みの場合はMapから削除してクリーンアップ
      this.workers.delete(apiKeyHash);
      logger.info(
        { apiKeyHash, stoppedCount: existingWorkers.length },
        "停止済みワーカーをクリーンアップしました",
      );
    }

    const concurrency = getConcurrency();
    const newWorkers: AiTaskWorker[] = [];

    logger.info({ apiKeyHash, concurrency }, "ワーカープールを開始します");

    for (let i = 0; i < concurrency; i++) {
      const workerId = `${apiKeyHash.substring(0, 8)}-${i + 1}-${uuidv4().substring(0, 8)}`;
      const worker = new AiTaskWorker(
        apiKeyHash,
        this.queueService,
        this.executor,
        workerId,
      );
      newWorkers.push(worker);

      // ワーカーを非同期で開始
      worker.start().catch((error) => {
        logger.error(
          { err: error, workerId, apiKeyHash },
          "ワーカー開始中にエラーが発生しました",
        );
      });
    }

    this.workers.set(apiKeyHash, newWorkers);
  }

  /**
   * 指定したAPIキーハッシュのワーカーを停止する
   * @param apiKeyHash APIキーハッシュ
   */
  async stopWorkers(apiKeyHash: string): Promise<void> {
    const existingWorkers = this.workers.get(apiKeyHash);
    if (!existingWorkers || existingWorkers.length === 0) {
      return;
    }

    logger.info(
      { apiKeyHash, workerCount: existingWorkers.length },
      "ワーカープールを停止します",
    );

    // 全ワーカーの停止を待機
    await Promise.all(existingWorkers.map((worker) => worker.stop()));

    this.workers.delete(apiKeyHash);

    logger.info({ apiKeyHash }, "ワーカープールが停止しました");
  }

  /**
   * 全てのワーカーを停止する
   */
  async stopAllWorkers(): Promise<void> {
    const apiKeyHashes = Array.from(this.workers.keys());

    logger.info(
      { apiKeyHashCount: apiKeyHashes.length },
      "全ワーカープールを停止します",
    );

    await Promise.all(apiKeyHashes.map((hash) => this.stopWorkers(hash)));

    logger.info("全ワーカープールが停止しました");
  }

  /**
   * 指定したAPIキーハッシュの実行中ワーカーが存在するか確認
   * @param apiKeyHash APIキーハッシュ
   * @returns 少なくとも1つのワーカーが実行中の場合true
   */
  hasWorkers(apiKeyHash: string): boolean {
    const workers = this.workers.get(apiKeyHash);
    if (!workers || workers.length === 0) {
      return false;
    }
    // 少なくとも1つのワーカーが実行中かどうかを確認
    // ワーカーが異常終了した場合、_isRunningがfalseになるが
    // Mapからは削除されないため、実行状態を確認する必要がある
    return workers.some((worker) => worker.isRunning);
  }

  /**
   * 実行中のワーカー数を取得
   */
  getRunningWorkerCount(): number {
    let count = 0;
    for (const workers of this.workers.values()) {
      count += workers.filter((w) => w.isRunning).length;
    }
    return count;
  }

  /**
   * 管理中のAPIキーハッシュ一覧を取得
   */
  getManagedApiKeyHashes(): string[] {
    return Array.from(this.workers.keys());
  }
}
