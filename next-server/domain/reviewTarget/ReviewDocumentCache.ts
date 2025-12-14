import { domainValidationError } from "@/lib/server/error";
import { ReviewDocumentCacheId } from "./ReviewDocumentCacheId";
import { ReviewTargetId } from "./ReviewTargetId";

/**
 * 処理モード定数
 */
export const PROCESS_MODE = {
  TEXT: "text",
  IMAGE: "image",
} as const;

export type ProcessModeValue = (typeof PROCESS_MODE)[keyof typeof PROCESS_MODE];

/**
 * レビュードキュメントキャッシュ作成パラメータ
 */
export interface CreateReviewDocumentCacheParams {
  reviewTargetId: string;
  fileName: string;
  processMode: string;
  cachePath: string | null;
}

/**
 * レビュードキュメントキャッシュ復元パラメータ
 */
export interface ReconstructReviewDocumentCacheParams {
  id: string;
  reviewTargetId: string;
  fileName: string;
  processMode: string;
  cachePath: string | null;
  createdAt: Date;
}

/**
 * レビュードキュメントキャッシュDTO
 */
export interface ReviewDocumentCacheDto {
  id: string;
  reviewTargetId: string;
  fileName: string;
  processMode: ProcessModeValue;
  cachePath: string | null;
  createdAt: Date;
}

/**
 * レビュードキュメントキャッシュエンティティ
 * レビュー対象ドキュメントの前処理結果（テキスト抽出・画像変換）をキャッシュするための情報を管理
 * リトライ時にドキュメントの再処理を省略するために使用
 */
export class ReviewDocumentCache {
  private readonly _id: ReviewDocumentCacheId;
  private readonly _reviewTargetId: ReviewTargetId;
  private readonly _fileName: string;
  private readonly _processMode: ProcessModeValue;
  private readonly _cachePath: string | null;
  private readonly _createdAt: Date;

  private constructor(
    id: ReviewDocumentCacheId,
    reviewTargetId: ReviewTargetId,
    fileName: string,
    processMode: ProcessModeValue,
    cachePath: string | null,
    createdAt: Date,
  ) {
    this._id = id;
    this._reviewTargetId = reviewTargetId;
    this._fileName = fileName;
    this._processMode = processMode;
    this._cachePath = cachePath;
    this._createdAt = createdAt;
  }

  /**
   * 新規レビュードキュメントキャッシュを作成する
   * @throws ドメインバリデーションエラー - バリデーション失敗時
   */
  static create(params: CreateReviewDocumentCacheParams): ReviewDocumentCache {
    const { reviewTargetId, fileName, processMode, cachePath } = params;

    // バリデーション
    ReviewDocumentCache.validateFileName(fileName);
    ReviewDocumentCache.validateProcessMode(processMode);

    return new ReviewDocumentCache(
      ReviewDocumentCacheId.create(),
      ReviewTargetId.reconstruct(reviewTargetId),
      fileName,
      processMode as ProcessModeValue,
      cachePath,
      new Date(),
    );
  }

  /**
   * DBから取得したデータからレビュードキュメントキャッシュを復元する
   */
  static reconstruct(
    params: ReconstructReviewDocumentCacheParams,
  ): ReviewDocumentCache {
    const { id, reviewTargetId, fileName, processMode, cachePath, createdAt } =
      params;

    return new ReviewDocumentCache(
      ReviewDocumentCacheId.reconstruct(id),
      ReviewTargetId.reconstruct(reviewTargetId),
      fileName,
      processMode as ProcessModeValue,
      cachePath,
      createdAt,
    );
  }

  /**
   * ファイル名のバリデーション
   * @throws ドメインバリデーションエラー - ファイル名が空の場合
   */
  private static validateFileName(fileName: string): void {
    if (!fileName || fileName.trim().length === 0) {
      throw domainValidationError("REVIEW_DOCUMENT_CACHE_FILE_NAME_EMPTY");
    }
  }

  /**
   * 処理モードのバリデーション
   * @throws ドメインバリデーションエラー - 処理モードが不正な場合
   */
  private static validateProcessMode(processMode: string): void {
    const validModes = Object.values(PROCESS_MODE);
    if (!validModes.includes(processMode as ProcessModeValue)) {
      throw domainValidationError("REVIEW_DOCUMENT_CACHE_PROCESS_MODE_INVALID");
    }
  }

  /**
   * キャッシュパスを設定した新しいインスタンスを返す
   */
  withCachePath(cachePath: string): ReviewDocumentCache {
    return new ReviewDocumentCache(
      this._id,
      this._reviewTargetId,
      this._fileName,
      this._processMode,
      cachePath,
      this._createdAt,
    );
  }

  /**
   * DTOに変換する
   */
  toDto(): ReviewDocumentCacheDto {
    return {
      id: this._id.value,
      reviewTargetId: this._reviewTargetId.value,
      fileName: this._fileName,
      processMode: this._processMode,
      cachePath: this._cachePath,
      createdAt: this._createdAt,
    };
  }

  /**
   * テキストモードかどうか
   */
  isTextMode(): boolean {
    return this._processMode === PROCESS_MODE.TEXT;
  }

  /**
   * 画像モードかどうか
   */
  isImageMode(): boolean {
    return this._processMode === PROCESS_MODE.IMAGE;
  }

  /**
   * キャッシュが有効かどうか（cachePathが設定されているか）
   */
  hasCache(): boolean {
    return this._cachePath !== null && this._cachePath.length > 0;
  }

  // ゲッター
  get id(): ReviewDocumentCacheId {
    return this._id;
  }

  get reviewTargetId(): ReviewTargetId {
    return this._reviewTargetId;
  }

  get fileName(): string {
    return this._fileName;
  }

  get processMode(): ProcessModeValue {
    return this._processMode;
  }

  get cachePath(): string | null {
    return this._cachePath;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
