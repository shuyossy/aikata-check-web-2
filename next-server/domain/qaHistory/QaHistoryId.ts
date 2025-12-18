import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { domainValidationError } from "@/lib/server/error";

/**
 * Q&A履歴ID値オブジェクト
 * Q&A履歴を一意に識別するためのUUID
 */
export class QaHistoryId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 新規UUIDを生成して返却する
   */
  static create(): QaHistoryId {
    return new QaHistoryId(uuidv4());
  }

  /**
   * 既存のUUID文字列から復元する
   * @throws ドメインバリデーションエラー - UUID形式が不正な場合
   */
  static reconstruct(value: string): QaHistoryId {
    QaHistoryId.validate(value);
    return new QaHistoryId(value);
  }

  /**
   * UUID形式の検証
   * @throws ドメインバリデーションエラー - UUID形式が不正な場合
   */
  private static validate(value: string): void {
    if (!value || !uuidValidate(value)) {
      throw domainValidationError("QA_HISTORY_ID_INVALID_FORMAT");
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
  equals(other: QaHistoryId): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
