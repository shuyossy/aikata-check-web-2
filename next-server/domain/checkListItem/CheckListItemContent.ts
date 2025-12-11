import { domainValidationError } from "@/lib/server/error";

/**
 * チェック項目内容値オブジェクト
 * チェック項目の内容（空でない文字列）
 */
export class CheckListItemContent {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 新規チェック項目内容を生成する
   * @throws ドメインバリデーションエラー - 内容が空の場合
   */
  static create(value: string): CheckListItemContent {
    CheckListItemContent.validate(value);
    return new CheckListItemContent(value);
  }

  /**
   * 既存の文字列から復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(value: string): CheckListItemContent {
    return new CheckListItemContent(value);
  }

  /**
   * チェック項目内容の検証
   * @throws ドメインバリデーションエラー - 内容が不正な場合
   */
  private static validate(value: string): void {
    if (!value || !value.trim()) {
      throw domainValidationError("CHECK_LIST_ITEM_CONTENT_EMPTY");
    }
  }

  /**
   * チェック項目内容を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: CheckListItemContent): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
