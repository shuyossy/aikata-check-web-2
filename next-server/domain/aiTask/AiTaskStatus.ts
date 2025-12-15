import { domainValidationError } from "@/lib/server/error";

/**
 * AIタスクステータス定数
 */
export const AI_TASK_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type AiTaskStatusValue =
  (typeof AI_TASK_STATUS)[keyof typeof AI_TASK_STATUS];

/**
 * AIタスクステータス値オブジェクト
 *
 * 状態遷移:
 * queued → processing → completed
 *                    → failed
 */
export class AiTaskStatus {
  private readonly _value: AiTaskStatusValue;

  private constructor(value: AiTaskStatusValue) {
    this._value = value;
  }

  /**
   * 新規ステータスを生成（初期状態はqueued）
   */
  static create(): AiTaskStatus {
    return new AiTaskStatus(AI_TASK_STATUS.QUEUED);
  }

  /**
   * 既存のステータス文字列から復元する
   * @throws ドメインバリデーションエラー - ステータスが不正な場合
   */
  static reconstruct(value: string): AiTaskStatus {
    AiTaskStatus.validate(value);
    return new AiTaskStatus(value as AiTaskStatusValue);
  }

  /**
   * ステータス値の検証
   * @throws ドメインバリデーションエラー - ステータスが不正な場合
   */
  private static validate(value: string): void {
    const validStatuses = Object.values(AI_TASK_STATUS);
    if (!validStatuses.includes(value as AiTaskStatusValue)) {
      throw domainValidationError("AI_TASK_STATUS_INVALID");
    }
  }

  /**
   * ステータス値を取得
   */
  get value(): AiTaskStatusValue {
    return this._value;
  }

  /**
   * queued状態かどうか
   */
  isQueued(): boolean {
    return this._value === AI_TASK_STATUS.QUEUED;
  }

  /**
   * processing状態かどうか
   */
  isProcessing(): boolean {
    return this._value === AI_TASK_STATUS.PROCESSING;
  }

  /**
   * completed状態かどうか
   */
  isCompleted(): boolean {
    return this._value === AI_TASK_STATUS.COMPLETED;
  }

  /**
   * failed状態かどうか
   */
  isFailed(): boolean {
    return this._value === AI_TASK_STATUS.FAILED;
  }

  /**
   * processing状態に遷移可能かどうか
   * queued状態からのみprocessingに遷移可能
   */
  canTransitionToProcessing(): boolean {
    return this._value === AI_TASK_STATUS.QUEUED;
  }

  /**
   * completed状態に遷移可能かどうか
   * processing状態からのみcompletedに遷移可能
   */
  canTransitionToCompleted(): boolean {
    return this._value === AI_TASK_STATUS.PROCESSING;
  }

  /**
   * failed状態に遷移可能かどうか
   * processing状態からのみfailedに遷移可能
   */
  canTransitionToFailed(): boolean {
    return this._value === AI_TASK_STATUS.PROCESSING;
  }

  /**
   * processing状態に遷移する
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  toProcessing(): AiTaskStatus {
    if (!this.canTransitionToProcessing()) {
      throw domainValidationError("AI_TASK_STATUS_INVALID_TRANSITION");
    }
    return new AiTaskStatus(AI_TASK_STATUS.PROCESSING);
  }

  /**
   * completed状態に遷移する
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  toCompleted(): AiTaskStatus {
    if (!this.canTransitionToCompleted()) {
      throw domainValidationError("AI_TASK_STATUS_INVALID_TRANSITION");
    }
    return new AiTaskStatus(AI_TASK_STATUS.COMPLETED);
  }

  /**
   * failed状態に遷移する
   * @throws ドメインバリデーションエラー - 遷移が不正な場合
   */
  toFailed(): AiTaskStatus {
    if (!this.canTransitionToFailed()) {
      throw domainValidationError("AI_TASK_STATUS_INVALID_TRANSITION");
    }
    return new AiTaskStatus(AI_TASK_STATUS.FAILED);
  }

  /**
   * 等価性の比較
   */
  equals(other: AiTaskStatus): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
