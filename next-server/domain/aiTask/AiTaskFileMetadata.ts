import { AiTaskFileMetadataId } from "./AiTaskFileMetadataId";
import { AiTaskId } from "./AiTaskId";

/**
 * 処理モード型
 * text: テキスト抽出モード
 * image: 画像変換モード
 */
export type ProcessMode = "text" | "image";

/**
 * AIタスクファイルメタデータ作成パラメータ
 * 注: taskIdはタスク作成時に設定されるため、初期作成時は不要
 */
export interface CreateAiTaskFileMetadataParams {
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** 処理モード（デフォルト: "text"） */
  processMode?: ProcessMode;
  /** 変換済み画像数（画像モードの場合のみ） */
  convertedImageCount?: number;
}

/**
 * AIタスクファイルメタデータ復元パラメータ
 */
export interface ReconstructAiTaskFileMetadataParams {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  /** 処理モード */
  processMode: ProcessMode;
  /** 変換済み画像数 */
  convertedImageCount: number;
  createdAt: Date;
}

/**
 * AIタスクファイルメタデータDTO
 */
export interface AiTaskFileMetadataDto {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  /** 処理モード */
  processMode: ProcessMode;
  /** 変換済み画像数 */
  convertedImageCount: number;
  createdAt: Date;
}

/**
 * AIタスクファイルメタデータエンティティ
 * AIタスクに関連するファイルの情報を保持する
 */
export class AiTaskFileMetadata {
  private readonly _id: AiTaskFileMetadataId;
  private readonly _taskId: AiTaskId | null;
  private readonly _fileName: string;
  private readonly _filePath: string;
  private readonly _fileSize: number;
  private readonly _mimeType: string;
  private readonly _processMode: ProcessMode;
  private readonly _convertedImageCount: number;
  private readonly _createdAt: Date;

  private constructor(
    id: AiTaskFileMetadataId,
    taskId: AiTaskId | null,
    fileName: string,
    filePath: string,
    fileSize: number,
    mimeType: string,
    processMode: ProcessMode,
    convertedImageCount: number,
    createdAt: Date,
  ) {
    this._id = id;
    this._taskId = taskId;
    this._fileName = fileName;
    this._filePath = filePath;
    this._fileSize = fileSize;
    this._mimeType = mimeType;
    this._processMode = processMode;
    this._convertedImageCount = convertedImageCount;
    this._createdAt = createdAt;
  }

  /**
   * 新規ファイルメタデータを作成
   * taskIdとファイルパスは後から設定される
   */
  static create(params: CreateAiTaskFileMetadataParams): AiTaskFileMetadata {
    return new AiTaskFileMetadata(
      AiTaskFileMetadataId.create(),
      null, // taskIdは後から設定
      params.fileName,
      "", // ファイルパスは保存後に設定
      params.fileSize,
      params.mimeType,
      params.processMode ?? "text",
      params.convertedImageCount ?? 0,
      new Date(),
    );
  }

  /**
   * DBから復元する
   */
  static reconstruct(
    params: ReconstructAiTaskFileMetadataParams,
  ): AiTaskFileMetadata {
    return new AiTaskFileMetadata(
      AiTaskFileMetadataId.reconstruct(params.id),
      AiTaskId.reconstruct(params.taskId),
      params.fileName,
      params.filePath,
      params.fileSize,
      params.mimeType,
      params.processMode,
      params.convertedImageCount,
      params.createdAt,
    );
  }

  /**
   * ファイルパスを設定した新しいインスタンスを返す
   */
  withFilePath(filePath: string): AiTaskFileMetadata {
    return new AiTaskFileMetadata(
      this._id,
      this._taskId,
      this._fileName,
      filePath,
      this._fileSize,
      this._mimeType,
      this._processMode,
      this._convertedImageCount,
      this._createdAt,
    );
  }

  /**
   * タスクIDを設定した新しいインスタンスを返す
   */
  withTaskId(taskId: AiTaskId): AiTaskFileMetadata {
    return new AiTaskFileMetadata(
      this._id,
      taskId,
      this._fileName,
      this._filePath,
      this._fileSize,
      this._mimeType,
      this._processMode,
      this._convertedImageCount,
      this._createdAt,
    );
  }

  get id(): AiTaskFileMetadataId {
    return this._id;
  }

  get taskId(): AiTaskId | null {
    return this._taskId;
  }

  get fileName(): string {
    return this._fileName;
  }

  get filePath(): string {
    return this._filePath;
  }

  get fileSize(): number {
    return this._fileSize;
  }

  get mimeType(): string {
    return this._mimeType;
  }

  get processMode(): ProcessMode {
    return this._processMode;
  }

  get convertedImageCount(): number {
    return this._convertedImageCount;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * 画像モードかどうか
   */
  isImageMode(): boolean {
    return this._processMode === "image";
  }

  /**
   * ファイルパスが設定されているかどうか
   */
  hasFilePath(): boolean {
    return this._filePath !== "";
  }

  /**
   * タスクIDが設定されているかどうか
   */
  hasTaskId(): boolean {
    return this._taskId !== null;
  }

  /**
   * DTOに変換
   */
  toDto(): AiTaskFileMetadataDto {
    return {
      id: this._id.value,
      taskId: this._taskId?.value ?? "",
      fileName: this._fileName,
      filePath: this._filePath,
      fileSize: this._fileSize,
      mimeType: this._mimeType,
      processMode: this._processMode,
      convertedImageCount: this._convertedImageCount,
      createdAt: this._createdAt,
    };
  }
}
