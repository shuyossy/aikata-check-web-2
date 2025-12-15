import { domainValidationError } from "@/lib/server/error";

/**
 * AIタスク優先度定数
 * 値が大きいほど優先度が高い
 */
export const AI_TASK_PRIORITY = {
  HIGH: 10,
  NORMAL: 5,
  LOW: 1,
} as const;

/**
 * AIタスク優先度値オブジェクト
 */
export class AiTaskPriority {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  /**
   * 通常優先度で生成（デフォルト）
   */
  static createNormal(): AiTaskPriority {
    return new AiTaskPriority(AI_TASK_PRIORITY.NORMAL);
  }

  /**
   * 高優先度で生成
   */
  static createHigh(): AiTaskPriority {
    return new AiTaskPriority(AI_TASK_PRIORITY.HIGH);
  }

  /**
   * 低優先度で生成
   */
  static createLow(): AiTaskPriority {
    return new AiTaskPriority(AI_TASK_PRIORITY.LOW);
  }

  /**
   * 数値から生成
   * @throws ドメインバリデーションエラー - 優先度が範囲外の場合
   */
  static create(value: number): AiTaskPriority {
    AiTaskPriority.validate(value);
    return new AiTaskPriority(value);
  }

  /**
   * 既存の優先度数値から復元する
   * @throws ドメインバリデーションエラー - 優先度が範囲外の場合
   */
  static reconstruct(value: number): AiTaskPriority {
    AiTaskPriority.validate(value);
    return new AiTaskPriority(value);
  }

  /**
   * 優先度値の検証
   * @throws ドメインバリデーションエラー - 優先度が範囲外の場合
   */
  private static validate(value: number): void {
    if (value < AI_TASK_PRIORITY.LOW || value > AI_TASK_PRIORITY.HIGH) {
      throw domainValidationError("AI_TASK_PRIORITY_INVALID");
    }
  }

  /**
   * 優先度値を取得
   */
  get value(): number {
    return this._value;
  }

  /**
   * 高優先度かどうか
   */
  isHigh(): boolean {
    return this._value === AI_TASK_PRIORITY.HIGH;
  }

  /**
   * 通常優先度かどうか
   */
  isNormal(): boolean {
    return this._value === AI_TASK_PRIORITY.NORMAL;
  }

  /**
   * 低優先度かどうか
   */
  isLow(): boolean {
    return this._value === AI_TASK_PRIORITY.LOW;
  }

  /**
   * 他の優先度より高いかどうか
   */
  isHigherThan(other: AiTaskPriority): boolean {
    return this._value > other._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: AiTaskPriority): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value.toString();
  }
}
