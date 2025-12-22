import { domainValidationError } from "@/lib/server/error";

/**
 * チェック項目内容値オブジェクト
 * Q&Aの対象となるチェック項目の内容スナップショットを表す
 */
export class CheckListItemContent {
  private readonly _value: string;

  /** チェック項目内容の最大文字数 */
  static readonly MAX_LENGTH = 5000;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * チェック項目内容を作成する
   * @throws ドメインバリデーションエラー - 空文字または文字数超過の場合
   */
  static create(value: string): CheckListItemContent {
    CheckListItemContent.validate(value);
    return new CheckListItemContent(value);
  }

  /**
   * 既存のチェック項目内容文字列から復元する（DBから読み込み時など）
   * バリデーションは行わない（既に保存されているデータは信頼する）
   */
  static reconstruct(value: string): CheckListItemContent {
    return new CheckListItemContent(value);
  }

  /**
   * チェック項目内容の検証
   * @throws ドメインバリデーションエラー - 空文字、空配列、または文字数超過の場合
   */
  private static validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw domainValidationError("QA_HISTORY_CHECKLIST_ITEM_CONTENT_EMPTY");
    }
    // JSON配列形式の場合、空配列でないことを確認
    if (value.startsWith("[")) {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        // JSONパースに失敗した場合は不正なJSON形式としてエラー
        throw domainValidationError(
          "QA_HISTORY_CHECKLIST_ITEM_CONTENT_INVALID_JSON",
        );
      }
      if (Array.isArray(parsed) && parsed.length === 0) {
        throw domainValidationError("QA_HISTORY_CHECKLIST_ITEM_CONTENT_EMPTY");
      }
    }
    if (value.length > CheckListItemContent.MAX_LENGTH) {
      throw domainValidationError("QA_HISTORY_CHECKLIST_ITEM_CONTENT_TOO_LONG");
    }
  }

  /**
   * チェック項目内容文字列を取得
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
