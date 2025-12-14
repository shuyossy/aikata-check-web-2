import { domainValidationError } from "@/lib/server/error";

/**
 * レビュー対象ステータス定数
 */
export const REVIEW_TARGET_STATUS = {
  PENDING: "pending",
  REVIEWING: "reviewing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type ReviewTargetStatusType =
  (typeof REVIEW_TARGET_STATUS)[keyof typeof REVIEW_TARGET_STATUS];

/**
 * レビュー対象ステータス値オブジェクト
 * pending → reviewing → completed/error の状態遷移を管理
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
   * レビュー中に遷移可能かどうか
   * pending, completed, error状態からreviewing状態に遷移可能（リトライのため）
   */
  canTransitionToReviewing(): boolean {
    return (
      this._value === REVIEW_TARGET_STATUS.PENDING ||
      this._value === REVIEW_TARGET_STATUS.COMPLETED ||
      this._value === REVIEW_TARGET_STATUS.ERROR
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
   */
  canTransitionToError(): boolean {
    return (
      this._value === REVIEW_TARGET_STATUS.PENDING ||
      this._value === REVIEW_TARGET_STATUS.REVIEWING
    );
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
