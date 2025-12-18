import { domainValidationError } from "@/lib/server/error";

/**
 * 回答値オブジェクト
 * AIによる回答内容を表す
 */
export class Answer {
  private readonly _value: string;

  /** 回答の最大文字数 */
  static readonly MAX_LENGTH = 10000;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 回答を作成する
   * @throws ドメインバリデーションエラー - 文字数超過の場合
   */
  static create(value: string): Answer {
    Answer.validate(value);
    return new Answer(value);
  }

  /**
   * 既存の回答文字列から復元する（DBから読み込み時など）
   * バリデーションは行わない（既に保存されているデータは信頼する）
   */
  static reconstruct(value: string): Answer {
    return new Answer(value);
  }

  /**
   * 回答の検証
   * @throws ドメインバリデーションエラー - 文字数超過の場合
   */
  private static validate(value: string): void {
    if (value.length > Answer.MAX_LENGTH) {
      throw domainValidationError("QA_HISTORY_ANSWER_TOO_LONG");
    }
  }

  /**
   * 回答文字列を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: Answer): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
