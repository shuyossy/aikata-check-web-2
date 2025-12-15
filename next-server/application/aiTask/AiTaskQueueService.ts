import { IAiTaskRepository } from "@/application/shared/port/repository/IAiTaskRepository";
import { IAiTaskFileMetadataRepository } from "@/application/shared/port/repository/IAiTaskFileMetadataRepository";
import {
  AiTask,
  AiTaskDto,
  AiTaskFileMetadata,
  AiTaskId,
  AI_TASK_STATUS,
  type ProcessMode,
} from "@/domain/aiTask";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { internalError } from "@/lib/server/error";
import { getLogger } from "@/lib/server/logger";
import type { AiTaskTypeValue } from "@/domain/aiTask";

const logger = getLogger();

/**
 * ファイル情報コマンド
 */
export interface FileInfoCommand {
  /** ファイルID（UUIDを事前に生成） */
  fileId: string;
  /** ファイル名 */
  fileName: string;
  /** ファイルサイズ（バイト） */
  fileSize: number;
  /** MIMEタイプ */
  mimeType: string;
  /**
   * 処理モード
   * text: テキスト抽出モード（元ファイルを保存）
   * image: 画像変換モード（変換済み画像を保存）
   */
  processMode: ProcessMode;
  /**
   * ファイルデータ
   * テキストモード: 元ファイルのバッファ
   * 画像モード: 空のバッファ（変換済み画像は convertedImageBuffers に格納）
   */
  buffer: Buffer;
  /**
   * 変換済み画像バッファの配列（画像モードの場合のみ）
   */
  convertedImageBuffers?: Buffer[];
}

/**
 * タスク登録コマンド
 */
export interface EnqueueTaskCommand {
  /** タスクタイプ */
  taskType: AiTaskTypeValue;
  /** APIキー（元の値、ハッシュ化は内部で行う） */
  apiKey: string;
  /** タスク実行に必要なペイロード */
  payload: Record<string, unknown>;
  /** 優先度（オプション、デフォルト: 5） */
  priority?: number;
  /** 関連ファイル情報 */
  files?: FileInfoCommand[];
}

/**
 * タスク登録結果
 */
export interface EnqueueTaskResult {
  /** タスクID */
  taskId: string;
  /** APIキーハッシュ（ワーカー起動用） */
  apiKeyHash: string;
  /** 現在のキュー長（登録後） */
  queueLength: number;
}

/**
 * タスク完了コマンド
 */
export interface CompleteTaskCommand {
  /** タスクID */
  taskId: string;
}

/**
 * タスク失敗コマンド
 */
export interface FailTaskCommand {
  /** タスクID */
  taskId: string;
  /** エラーメッセージ */
  errorMessage: string;
}

/**
 * AIタスクキュー管理サービス
 * キューの登録・取得・完了・失敗処理を管理する
 */
export class AiTaskQueueService {
  constructor(
    private readonly aiTaskRepository: IAiTaskRepository,
    private readonly aiTaskFileMetadataRepository: IAiTaskFileMetadataRepository,
  ) {}

  /**
   * タスクをキューに登録する
   * @param command 登録コマンド
   * @returns 登録結果
   */
  async enqueueTask(command: EnqueueTaskCommand): Promise<EnqueueTaskResult> {
    const { taskType, apiKey, payload, priority, files = [] } = command;

    try {
      // ファイルメタデータを作成
      const fileMetadata: AiTaskFileMetadata[] = files.map((file) =>
        AiTaskFileMetadata.create({
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          processMode: file.processMode,
          convertedImageCount: file.convertedImageBuffers?.length ?? 0,
        }),
      );

      // タスクを作成
      const task = AiTask.create({
        taskType,
        apiKey,
        payload,
        priority,
        fileMetadata,
      });

      // ファイルを保存し、パスを設定
      const fileMetadataWithPaths: AiTaskFileMetadata[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const metadata = task.fileMetadata[i];

        let filePath = "";

        if (file.processMode === "image" && file.convertedImageBuffers && file.convertedImageBuffers.length > 0) {
          // 画像モード: 変換済み画像を保存
          await TaskFileHelper.saveConvertedImages(
            task.id.value,
            metadata.id.value,
            file.convertedImageBuffers,
          );
          // 画像モードでは filePath は最初の画像へのパスを設定（復元時は fileId + count で復元）
          filePath = TaskFileHelper.getConvertedImagePath(task.id.value, metadata.id.value, 0);
        } else {
          // テキストモード: 元ファイルを保存
          filePath = await TaskFileHelper.saveFile(
            task.id.value,
            metadata.id.value,
            file.buffer,
            file.fileName,
          );
        }

        // タスクIDとファイルパスを設定
        const updatedMetadata = metadata
          .withTaskId(task.id)
          .withFilePath(filePath);
        fileMetadataWithPaths.push(updatedMetadata);
      }

      // ファイルメタデータ付きのタスクを再作成（immutableのため）
      const taskWithFiles = AiTask.reconstruct({
        id: task.id.value,
        taskType: task.taskType.value,
        status: task.status.value,
        apiKeyHash: task.apiKeyHash,
        priority: task.priority.value,
        payload: task.payload,
        errorMessage: task.errorMessage,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        fileMetadata: fileMetadataWithPaths.map((fm) => ({
          id: fm.id.value,
          taskId: task.id.value,
          fileName: fm.fileName,
          filePath: fm.filePath,
          fileSize: fm.fileSize,
          mimeType: fm.mimeType,
          processMode: fm.processMode,
          convertedImageCount: fm.convertedImageCount,
          createdAt: fm.createdAt,
        })),
      });

      // DBに保存
      await this.aiTaskRepository.save(taskWithFiles);

      // キュー長を取得
      const queueLength = await this.aiTaskRepository.countQueuedByApiKeyHash(
        task.apiKeyHash,
      );

      logger.info(
        {
          taskId: task.id.value,
          taskType,
          apiKeyHash: task.apiKeyHash,
          queueLength,
          fileCount: files.length,
        },
        "タスクをキューに登録しました",
      );

      return {
        taskId: task.id.value,
        apiKeyHash: task.apiKeyHash,
        queueLength,
      };
    } catch (error) {
      logger.error({ err: error, taskType }, "タスク登録に失敗しました");
      throw internalError({
        expose: true,
        messageCode: "AI_TASK_ENQUEUE_FAILED",
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * 次のタスクを取得する（処理中に遷移）
   * @param apiKeyHash APIキーハッシュ
   * @returns タスクDTO（キューが空の場合はnull）
   */
  async dequeueTask(apiKeyHash: string): Promise<AiTaskDto | null> {
    const task = await this.aiTaskRepository.dequeueNextTask(apiKeyHash);

    if (task) {
      logger.debug(
        {
          taskId: task.id.value,
          taskType: task.taskType.value,
          apiKeyHash,
        },
        "タスクをデキューしました",
      );
    }

    return task ? task.toDto() : null;
  }

  /**
   * タスクを完了としてマークし、削除する
   * @param command 完了コマンド
   */
  async completeTask(command: CompleteTaskCommand): Promise<void> {
    const taskId = AiTaskId.reconstruct(command.taskId);
    const task = await this.aiTaskRepository.findById(taskId);

    if (!task) {
      logger.warn({ taskId: command.taskId }, "完了対象のタスクが見つかりません");
      return; // 既に削除されている場合は何もしない
    }

    // 処理中から完了に遷移（結果は使用しないが、状態遷移の妥当性を検証するため呼び出す）
    task.completeWithSuccess();

    logger.info(
      {
        taskId: command.taskId,
        taskType: task.taskType.value,
        apiKeyHash: task.apiKeyHash,
      },
      "タスクを完了としてマークしました",
    );

    // タスクとファイルを削除（シンプル運用）
    await this.cleanupTask(taskId.value, task.apiKeyHash);
  }

  /**
   * タスクを失敗としてマークし、削除する
   * @param command 失敗コマンド
   */
  async failTask(command: FailTaskCommand): Promise<void> {
    const taskId = AiTaskId.reconstruct(command.taskId);
    const task = await this.aiTaskRepository.findById(taskId);

    if (!task) {
      logger.warn({ taskId: command.taskId }, "失敗対象のタスクが見つかりません");
      return; // 既に削除されている場合は何もしない
    }

    // 処理中から失敗に遷移（結果は使用しないが、状態遷移の妥当性を検証するため呼び出す）
    task.failWithError(command.errorMessage);

    logger.error(
      {
        taskId: command.taskId,
        taskType: task.taskType.value,
        apiKeyHash: task.apiKeyHash,
        errorMessage: command.errorMessage,
      },
      "タスクを失敗としてマークしました",
    );

    // タスクとファイルを削除（シンプル運用）
    await this.cleanupTask(taskId.value, task.apiKeyHash);
  }

  /**
   * キュー長を取得する
   * @param apiKeyHash APIキーハッシュ
   * @returns キュー待機中のタスク数
   */
  async getQueueLength(apiKeyHash: string): Promise<number> {
    return this.aiTaskRepository.countQueuedByApiKeyHash(apiKeyHash);
  }

  /**
   * IDでタスクを取得する
   * @param taskId タスクID
   * @returns タスクDTO（存在しない場合はnull）
   */
  async findById(taskId: string): Promise<AiTaskDto | null> {
    const id = AiTaskId.reconstruct(taskId);
    const task = await this.aiTaskRepository.findById(id);
    return task ? task.toDto() : null;
  }

  /**
   * キューにあるユニークなAPIキーハッシュ一覧を取得
   * @returns APIキーハッシュの配列
   */
  async findDistinctApiKeyHashesInQueue(): Promise<string[]> {
    return this.aiTaskRepository.findDistinctApiKeyHashesInQueue();
  }

  /**
   * 処理中のタスク一覧を取得
   * @returns 処理中のタスクDTO配列
   */
  async findProcessingTasks(): Promise<AiTaskDto[]> {
    const tasks = await this.aiTaskRepository.findByStatus(
      AI_TASK_STATUS.PROCESSING,
    );
    return tasks.map((task) => task.toDto());
  }

  /**
   * タスクと関連ファイルをクリーンアップする
   * @param taskId タスクID
   * @param apiKeyHash APIキーハッシュ（ログ用）
   */
  private async cleanupTask(taskId: string, apiKeyHash: string): Promise<void> {
    try {
      // ファイルを削除
      await TaskFileHelper.deleteTaskFiles(taskId);
      // DBからタスクを削除（CASCADE削除でファイルメタデータも削除）
      await this.aiTaskRepository.delete(AiTaskId.reconstruct(taskId));
      logger.debug({ taskId, apiKeyHash }, "タスクをクリーンアップしました");
    } catch (error) {
      logger.warn(
        { err: error, taskId },
        "タスククリーンアップ中にエラーが発生しましたが、続行します",
      );
    }
  }
}
