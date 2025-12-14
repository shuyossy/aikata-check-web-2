import { domainValidationError } from "@/lib/server/error";

/**
 * レビュー種別定数
 */
export const REVIEW_TYPE = {
  SMALL: "small",
  LARGE: "large",
  API: "api",
} as const;

export type ReviewTypeValue = (typeof REVIEW_TYPE)[keyof typeof REVIEW_TYPE];

/**
 * レビュー種別値オブジェクト
 * 少量レビュー（small）と大量レビュー（large）を区別する
 */
export class ReviewType {
  private readonly _value: ReviewTypeValue;

  private constructor(value: ReviewTypeValue) {
    this._value = value;
  }

  /**
   * 新規レビュー種別を生成する
   * @throws ドメインバリデーションエラー - 種別が不正な場合
   */
  static create(value: string): ReviewType {
    ReviewType.validate(value);
    return new ReviewType(value as ReviewTypeValue);
  }

  /**
   * 既存のレビュー種別文字列から復元する
   * @throws ドメインバリデーションエラー - 種別が不正な場合
   */
  static reconstruct(value: string): ReviewType {
    ReviewType.validate(value);
    return new ReviewType(value as ReviewTypeValue);
  }

  /**
   * レビュー種別値の検証
   * @throws ドメインバリデーションエラー - 種別が不正な場合
   */
  private static validate(value: string): void {
    const validTypes = Object.values(REVIEW_TYPE);
    if (!validTypes.includes(value as ReviewTypeValue)) {
      throw domainValidationError("REVIEW_TYPE_INVALID");
    }
  }

  /**
   * レビュー種別値を取得
   */
  get value(): ReviewTypeValue {
    return this._value;
  }

  /**
   * 少量レビューかどうか
   */
  isSmall(): boolean {
    return this._value === REVIEW_TYPE.SMALL;
  }

  /**
   * 大量レビューかどうか
   */
  isLarge(): boolean {
    return this._value === REVIEW_TYPE.LARGE;
  }

  /**
   * 外部API呼び出しレビューかどうか
   */
  isApi(): boolean {
    return this._value === REVIEW_TYPE.API;
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewType): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
