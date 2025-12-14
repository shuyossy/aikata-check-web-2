import { domainValidationError } from "@/lib/server/error";

/**
 * レビュー対象名値オブジェクト
 * レビュー対象の名前（最大255文字）
 */
export class ReviewTargetName {
  private static readonly MAX_LENGTH = 255;
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 新規レビュー対象名を生成する
   * @throws ドメインバリデーションエラー - 名前が空または255文字超過の場合
   */
  static create(value: string): ReviewTargetName {
    ReviewTargetName.validate(value);
    return new ReviewTargetName(value);
  }

  /**
   * 既存の文字列から復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(value: string): ReviewTargetName {
    return new ReviewTargetName(value);
  }

  /**
   * レビュー対象名の検証
   * @throws ドメインバリデーションエラー - 名前が不正な場合
   */
  private static validate(value: string): void {
    if (!value || !value.trim()) {
      throw domainValidationError("REVIEW_TARGET_NAME_EMPTY");
    }

    if (value.length > ReviewTargetName.MAX_LENGTH) {
      throw domainValidationError("REVIEW_TARGET_NAME_TOO_LONG");
    }
  }

  /**
   * レビュー対象名を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewTargetName): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
