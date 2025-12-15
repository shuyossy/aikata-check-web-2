import { domainValidationError } from "@/lib/server/error";

/**
 * レビュー対象ステータス定数
 */
export const REVIEW_TARGET_STATUS = {
  PENDING: "pending",
  QUEUED: "queued",
  REVIEWING: "reviewing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type ReviewTargetStatusType =
  (typeof REVIEW_TARGET_STATUS)[keyof typeof REVIEW_TARGET_STATUS];

/**
 * レビュー対象ステータス値オブジェクト
 * 状態遷移:
 *   キュー経由（少量/大量レビュー）: pending → queued → reviewing → completed/error
 *   API呼び出しレビュー: pending → reviewing → completed/error
 * リトライ時:
 *   completed/error → queued → reviewing → completed/error
 */
export class ReviewTargetStatus {
  private readonly _value: ReviewTargetStatusType;

  private constructor(value: ReviewTargetStatusType) {
    this._value = value;
  }

  /**
   * 新規ステータスを生成（初期状態はpending）
   */
  static create(): ReviewTargetStatus {
    return new ReviewTargetStatus(REVIEW_TARGET_STATUS.PENDING);
  }

  /**
   * 既存のステータス文字列から復元する
   * @throws ドメインバリデーションエラー - ステータスが不正な場合
   */
  static reconstruct(value: string): ReviewTargetStatus {
    ReviewTargetStatus.validate(value);
    return new ReviewTargetStatus(value as ReviewTargetStatusType);
  }

  /**
   * ステータス値の検証
   * @throws ドメインバリデーションエラー - ステータスが不正な場合
   */
  private static validate(value: string): void {
    const validStatuses = Object.values(REVIEW_TARGET_STATUS);
    if (!validStatuses.includes(value as ReviewTargetStatusType)) {
      throw domainValidationError("REVIEW_TARGET_STATUS_INVALID");
    }
  }

  /**
   * ステータス値を取得
   */
  get value(): ReviewTargetStatusType {
    return this._value;
  }

  /**
   * pending状態かどうか
   */
  isPending(): boolean {
    return this._value === REVIEW_TARGET_STATUS.PENDING;
  }

  /**
   * reviewing状態かどうか
   */
  isReviewing(): boolean {
    return this._value === REVIEW_TARGET_STATUS.REVIEWING;
  }

  /**
   * completed状態かどうか
   */
  isCompleted(): boolean {
    return this._value === REVIEW_TARGET_STATUS.COMPLETED;
  }

  /**
   * error状態かどうか
   */
  isError(): boolean {
    return this._value === REVIEW_TARGET_STATUS.ERROR;
  }

  /**
   * queued状態かどうか
   */
  isQueued(): boolean {
    return this._value === REVIEW_TARGET_STATUS.QUEUED;
  }

  /**
   * キュー待機中に遷移可能かどうか
   * pending, completed, error状態からqueued状態に遷移可能
   */
  canTransitionToQueued(): boolean {
    return (
      this._value === REVIEW_TARGET_STATUS.PENDING ||
      this._value === REVIEW_TARGET_STATUS.COMPLETED ||
      this._value === REVIEW_TARGET_STATUS.ERROR
    );
  }

  /**
   * レビュー中に遷移可能かどうか
   * pending（API呼び出しレビュー用）またはqueued状態からreviewing状態に遷移可能
   */
  canTransitionToReviewing(): boolean {
    return (
      this._value === REVIEW_TARGET_STATUS.PENDING ||
      this._value === REVIEW_TARGET_STATUS.QUEUED
    );
  }

  /**
   * 完了状態に遷移可能かどうか
   */
  canTransitionToCompleted(): boolean {
    return this._value === REVIEW_TARGET_STATUS.REVIEWING;
  }

  /**
   * エラー状態に遷移可能かどうか
   * pending, queued, reviewing状態からerror状態に遷移可能
   */
  canTransitionToError(): boolean {
    return (
      this._value === REVIEW_TARGET_STATUS.PENDING ||
      this._value === REVIEW_TARGET_STATUS.QUEUED ||
      this._value === REVIEW_TARGET_STATUS.REVIEWING
    );
  }

  /**
   * キュー待機中状態に遷移する
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  toQueued(): ReviewTargetStatus {
    if (!this.canTransitionToQueued()) {
      throw domainValidationError("REVIEW_TARGET_STATUS_INVALID_TRANSITION");
    }
    return new ReviewTargetStatus(REVIEW_TARGET_STATUS.QUEUED);
  }

  /**
   * レビュー中状態に遷移する
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  toReviewing(): ReviewTargetStatus {
    if (!this.canTransitionToReviewing()) {
      throw domainValidationError("REVIEW_TARGET_STATUS_INVALID_TRANSITION");
    }
    return new ReviewTargetStatus(REVIEW_TARGET_STATUS.REVIEWING);
  }

  /**
   * 完了状態に遷移する
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  toCompleted(): ReviewTargetStatus {
    if (!this.canTransitionToCompleted()) {
      throw domainValidationError("REVIEW_TARGET_STATUS_INVALID_TRANSITION");
    }
    return new ReviewTargetStatus(REVIEW_TARGET_STATUS.COMPLETED);
  }

  /**
   * エラー状態に遷移する
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  toError(): ReviewTargetStatus {
    if (!this.canTransitionToError()) {
      throw domainValidationError("REVIEW_TARGET_STATUS_INVALID_TRANSITION");
    }
    return new ReviewTargetStatus(REVIEW_TARGET_STATUS.ERROR);
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewTargetStatus): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
