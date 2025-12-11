import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { domainValidationError } from "@/lib/server/error";

/**
 * レビュースペースID値オブジェクト
 * レビュースペースを一意に識別するためのUUID
 */
export class ReviewSpaceId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 新規UUIDを生成して返却する
   */
  static create(): ReviewSpaceId {
    return new ReviewSpaceId(uuidv4());
  }

  /**
   * 既存のUUID文字列から復元する
   * @throws ドメインバリデーションエラー - UUID形式が不正な場合
   */
  static reconstruct(value: string): ReviewSpaceId {
    ReviewSpaceId.validate(value);
    return new ReviewSpaceId(value);
  }

  /**
   * UUID形式の検証
   * @throws ドメインバリデーションエラー - UUID形式が不正な場合
   */
  private static validate(value: string): void {
    if (!value || !uuidValidate(value)) {
      throw domainValidationError("REVIEW_SPACE_ID_INVALID_FORMAT");
    }
  }

  /**
   * UUID文字列を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewSpaceId): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
