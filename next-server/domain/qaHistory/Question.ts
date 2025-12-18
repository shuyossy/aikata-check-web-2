import { domainValidationError } from "@/lib/server/error";

/**
 * 質問値オブジェクト
 * Q&Aの質問内容を表す
 */
export class Question {
  private readonly _value: string;

  /** 質問の最大文字数 */
  static readonly MAX_LENGTH = 2000;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 質問を作成する
   * @throws ドメインバリデーションエラー - 空文字または文字数超過の場合
   */
  static create(value: string): Question {
    Question.validate(value);
    return new Question(value);
  }

  /**
   * 既存の質問文字列から復元する（DBから読み込み時など）
   * バリデーションは行わない（既に保存されているデータは信頼する）
   */
  static reconstruct(value: string): Question {
    return new Question(value);
  }

  /**
   * 質問の検証
   * @throws ドメインバリデーションエラー - 空文字または文字数超過の場合
   */
  private static validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw domainValidationError("QA_HISTORY_QUESTION_EMPTY");
    }
    if (value.length > Question.MAX_LENGTH) {
      throw domainValidationError("QA_HISTORY_QUESTION_TOO_LONG");
    }
  }

  /**
   * 質問文字列を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: Question): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
