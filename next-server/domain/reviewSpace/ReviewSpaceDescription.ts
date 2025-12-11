import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペース説明値オブジェクト
 * レビュースペースの詳細説明（任意、最大1000文字）
 */
export class ReviewSpaceDescription {
  private static readonly MAX_LENGTH = 1000;
  private readonly _value: string | null;

  private constructor(value: string | null) {
    this._value = value;
  }

  /**
   * 新規スペース説明を生成する
   * @throws ドメインバリデーションエラー - 1000文字超過の場合
   */
  static create(value: string | null | undefined): ReviewSpaceDescription {
    const normalizedValue = value?.trim() || null;
    ReviewSpaceDescription.validate(normalizedValue);
    return new ReviewSpaceDescription(normalizedValue);
  }

  /**
   * 既存の文字列から復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(value: string | null): ReviewSpaceDescription {
    return new ReviewSpaceDescription(value);
  }

  /**
   * スペース説明の検証
   * @throws ドメインバリデーションエラー - 説明が1000文字超過の場合
   */
  private static validate(value: string | null): void {
    if (value && value.length > ReviewSpaceDescription.MAX_LENGTH) {
      throw domainValidationError("REVIEW_SPACE_DESCRIPTION_TOO_LONG");
    }
  }

  /**
   * スペース説明を取得
   */
  get value(): string | null {
    return this._value;
  }

  /**
   * 値が設定されているか確認
   */
  hasValue(): boolean {
    return this._value !== null;
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewSpaceDescription): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value ?? "";
  }
}
