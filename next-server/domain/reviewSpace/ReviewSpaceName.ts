import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペース名値オブジェクト
 * レビュースペースを識別するための名称（1-100文字）
 */
export class ReviewSpaceName {
  private static readonly MAX_LENGTH = 100;
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 新規スペース名を生成する
   * @throws ドメインバリデーションエラー - 名前が空または100文字超過の場合
   */
  static create(value: string): ReviewSpaceName {
    ReviewSpaceName.validate(value);
    return new ReviewSpaceName(value);
  }

  /**
   * 既存の文字列から復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(value: string): ReviewSpaceName {
    return new ReviewSpaceName(value);
  }

  /**
   * スペース名の検証
   * @throws ドメインバリデーションエラー - 名前が不正な場合
   */
  private static validate(value: string): void {
    if (!value || !value.trim()) {
      throw domainValidationError("REVIEW_SPACE_NAME_EMPTY");
    }

    if (value.length > ReviewSpaceName.MAX_LENGTH) {
      throw domainValidationError("REVIEW_SPACE_NAME_TOO_LONG");
    }
  }

  /**
   * スペース名を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewSpaceName): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
