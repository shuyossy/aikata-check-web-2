import { domainValidationError } from "@/lib/server/error";

/**
 * AIタスクタイプ定数
 */
export const AI_TASK_TYPE = {
  SMALL_REVIEW: "small_review",
  LARGE_REVIEW: "large_review",
  CHECKLIST_GENERATION: "checklist_generation",
} as const;

export type AiTaskTypeValue = (typeof AI_TASK_TYPE)[keyof typeof AI_TASK_TYPE];

/**
 * AIタスクタイプ値オブジェクト
 * 少量レビュー、大量レビュー、チェックリスト生成を区別する
 */
export class AiTaskType {
  private readonly _value: AiTaskTypeValue;

  private constructor(value: AiTaskTypeValue) {
    this._value = value;
  }

  /**
   * 新規タスクタイプを生成する
   * @throws ドメインバリデーションエラー - タイプが不正な場合
   */
  static create(value: string): AiTaskType {
    AiTaskType.validate(value);
    return new AiTaskType(value as AiTaskTypeValue);
  }

  /**
   * 既存のタスクタイプ文字列から復元する
   * @throws ドメインバリデーションエラー - タイプが不正な場合
   */
  static reconstruct(value: string): AiTaskType {
    AiTaskType.validate(value);
    return new AiTaskType(value as AiTaskTypeValue);
  }

  /**
   * タスクタイプ値の検証
   * @throws ドメインバリデーションエラー - タイプが不正な場合
   */
  private static validate(value: string): void {
    const validTypes = Object.values(AI_TASK_TYPE);
    if (!validTypes.includes(value as AiTaskTypeValue)) {
      throw domainValidationError("AI_TASK_TYPE_INVALID");
    }
  }

  /**
   * タスクタイプ値を取得
   */
  get value(): AiTaskTypeValue {
    return this._value;
  }

  /**
   * 少量レビューかどうか
   */
  isSmallReview(): boolean {
    return this._value === AI_TASK_TYPE.SMALL_REVIEW;
  }

  /**
   * 大量レビューかどうか
   */
  isLargeReview(): boolean {
    return this._value === AI_TASK_TYPE.LARGE_REVIEW;
  }

  /**
   * チェックリスト生成かどうか
   */
  isChecklistGeneration(): boolean {
    return this._value === AI_TASK_TYPE.CHECKLIST_GENERATION;
  }

  /**
   * レビュー系タスクかどうか
   */
  isReviewTask(): boolean {
    return this.isSmallReview() || this.isLargeReview();
  }

  /**
   * 等価性の比較
   */
  equals(other: AiTaskType): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
