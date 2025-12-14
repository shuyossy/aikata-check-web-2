import { domainValidationError } from "@/lib/server/error";

/**
 * 評価値オブジェクト
 * AIによる評価ラベル（最大20文字）
 */
export class Evaluation {
  private static readonly MAX_LENGTH = 20;
  private readonly _value: string | null;

  private constructor(value: string | null) {
    this._value = value;
  }

  /**
   * 新規評価を生成する
   * @throws ドメインバリデーションエラー - ラベルが20文字超過の場合
   */
  static create(value: string | null): Evaluation {
    if (value !== null) {
      Evaluation.validate(value);
    }
    return new Evaluation(value);
  }

  /**
   * 既存の評価から復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(value: string | null): Evaluation {
    return new Evaluation(value);
  }

  /**
   * 評価の検証
   * @throws ドメインバリデーションエラー - ラベルが不正な場合
   */
  private static validate(value: string): void {
    if (value.length > Evaluation.MAX_LENGTH) {
      throw domainValidationError("REVIEW_RESULT_EVALUATION_TOO_LONG");
    }
  }

  /**
   * 評価値を取得
   */
  get value(): string | null {
    return this._value;
  }

  /**
   * 評価が設定されているかどうか
   */
  hasValue(): boolean {
    return this._value !== null;
  }

  /**
   * 等価性の比較
   */
  equals(other: Evaluation): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value ?? "";
  }
}
