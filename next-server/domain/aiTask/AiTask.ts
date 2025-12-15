import { createHash } from "crypto";
import { AiTaskId } from "./AiTaskId";
import { AiTaskType, AI_TASK_TYPE, AiTaskTypeValue } from "./AiTaskType";
import { AiTaskStatus, AI_TASK_STATUS, AiTaskStatusValue } from "./AiTaskStatus";
import { AiTaskPriority } from "./AiTaskPriority";
import {
  AiTaskFileMetadata,
  AiTaskFileMetadataDto,
  ReconstructAiTaskFileMetadataParams,
} from "./AiTaskFileMetadata";

/**
 * AIタスク作成パラメータ
 */
export interface CreateAiTaskParams {
  taskType: string;
  apiKey: string;
  payload: Record<string, unknown>;
  priority?: number;
  fileMetadata?: AiTaskFileMetadata[];
}

/**
 * AIタスク復元パラメータ
 */
export interface ReconstructAiTaskParams {
  id: string;
  taskType: string;
  status: string;
  apiKeyHash: string;
  priority: number;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  fileMetadata: ReconstructAiTaskFileMetadataParams[];
}

/**
 * AIタスクDTO
 */
export interface AiTaskDto {
  id: string;
  taskType: AiTaskTypeValue;
  status: AiTaskStatusValue;
  apiKeyHash: string;
  priority: number;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  fileMetadata: AiTaskFileMetadataDto[];
}

/**
 * APIキーをSHA-256でハッシュ化する
 */
function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * AIタスクエンティティ
 * キューに登録されるAI処理タスクを表現
 */
export class AiTask {
  private readonly _id: AiTaskId;
  private readonly _taskType: AiTaskType;
  private readonly _status: AiTaskStatus;
  private readonly _apiKeyHash: string;
  private readonly _priority: AiTaskPriority;
  private readonly _payload: Record<string, unknown>;
  private readonly _errorMessage: string | null;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;
  private readonly _startedAt: Date | null;
  private readonly _completedAt: Date | null;
  private readonly _fileMetadata: AiTaskFileMetadata[];

  private constructor(
    id: AiTaskId,
    taskType: AiTaskType,
    status: AiTaskStatus,
    apiKeyHash: string,
    priority: AiTaskPriority,
    payload: Record<string, unknown>,
    errorMessage: string | null,
    createdAt: Date,
    updatedAt: Date,
    startedAt: Date | null,
    completedAt: Date | null,
    fileMetadata: AiTaskFileMetadata[],
  ) {
    this._id = id;
    this._taskType = taskType;
    this._status = status;
    this._apiKeyHash = apiKeyHash;
    this._priority = priority;
    this._payload = payload;
    this._errorMessage = errorMessage;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._startedAt = startedAt;
    this._completedAt = completedAt;
    this._fileMetadata = fileMetadata;
  }

  /**
   * 新規タスクを作成（status: queued）
   * APIキーはSHA-256でハッシュ化して保存
   */
  static create(params: CreateAiTaskParams): AiTask {
    const now = new Date();
    return new AiTask(
      AiTaskId.create(),
      AiTaskType.create(params.taskType),
      AiTaskStatus.create(), // queued
      hashApiKey(params.apiKey),
      params.priority !== undefined
        ? AiTaskPriority.create(params.priority)
        : AiTaskPriority.createNormal(),
      params.payload,
      null, // errorMessage
      now, // createdAt
      now, // updatedAt
      null, // startedAt
      null, // completedAt
      params.fileMetadata ?? [],
    );
  }

  /**
   * DBから復元する
   */
  static reconstruct(params: ReconstructAiTaskParams): AiTask {
    const fileMetadata = params.fileMetadata.map((fm) =>
      AiTaskFileMetadata.reconstruct(fm)
    );
    return new AiTask(
      AiTaskId.reconstruct(params.id),
      AiTaskType.reconstruct(params.taskType),
      AiTaskStatus.reconstruct(params.status),
      params.apiKeyHash,
      AiTaskPriority.reconstruct(params.priority),
      params.payload,
      params.errorMessage,
      params.createdAt,
      params.updatedAt,
      params.startedAt,
      params.completedAt,
      fileMetadata,
    );
  }

  /**
   * 処理中に遷移する
   * queued → processing
   */
  startProcessing(): AiTask {
    const newStatus = this._status.toProcessing();
    const now = new Date();
    return new AiTask(
      this._id,
      this._taskType,
      newStatus,
      this._apiKeyHash,
      this._priority,
      this._payload,
      this._errorMessage,
      this._createdAt,
      now, // updatedAt
      now, // startedAt
      this._completedAt,
      this._fileMetadata,
    );
  }

  /**
   * 完了に遷移する
   * processing → completed
   */
  completeWithSuccess(): AiTask {
    const newStatus = this._status.toCompleted();
    const now = new Date();
    return new AiTask(
      this._id,
      this._taskType,
      newStatus,
      this._apiKeyHash,
      this._priority,
      this._payload,
      this._errorMessage,
      this._createdAt,
      now, // updatedAt
      this._startedAt,
      now, // completedAt
      this._fileMetadata,
    );
  }

  /**
   * 失敗に遷移する
   * processing → failed
   */
  failWithError(errorMessage: string): AiTask {
    const newStatus = this._status.toFailed();
    const now = new Date();
    return new AiTask(
      this._id,
      this._taskType,
      newStatus,
      this._apiKeyHash,
      this._priority,
      this._payload,
      errorMessage,
      this._createdAt,
      now, // updatedAt
      this._startedAt,
      now, // completedAt
      this._fileMetadata,
    );
  }

  // Getters
  get id(): AiTaskId {
    return this._id;
  }

  get taskType(): AiTaskType {
    return this._taskType;
  }

  get status(): AiTaskStatus {
    return this._status;
  }

  get apiKeyHash(): string {
    return this._apiKeyHash;
  }

  get priority(): AiTaskPriority {
    return this._priority;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get fileMetadata(): AiTaskFileMetadata[] {
    return this._fileMetadata;
  }

  /**
   * DTOに変換
   */
  toDto(): AiTaskDto {
    return {
      id: this._id.value,
      taskType: this._taskType.value,
      status: this._status.value,
      apiKeyHash: this._apiKeyHash,
      priority: this._priority.value,
      payload: this._payload,
      errorMessage: this._errorMessage,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      fileMetadata: this._fileMetadata.map((fm) => fm.toDto()),
    };
  }
}

// 定数のre-export
export { AI_TASK_TYPE, AI_TASK_STATUS };
