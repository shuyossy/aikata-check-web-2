import { domainValidationError } from "@/lib/server/error";

/**
 * Q&Aステータスの有効な値
 */
export const QA_STATUS_VALUES = ["pending", "processing", "completed", "error"] as const;
export type QaStatusValue = (typeof QA_STATUS_VALUES)[number];

/**
 * Q&Aステータス値オブジェクト
 * Q&A処理の状態を表す
 */
export class QaStatus {
  private readonly _value: QaStatusValue;

  private constructor(value: QaStatusValue) {
    this._value = value;
  }

  /**
   * Q&Aステータスを作成する
   * @throws ドメインバリデーションエラー - 無効なステータスの場合
   */
  static create(value: string): QaStatus {
    QaStatus.validate(value);
    return new QaStatus(value as QaStatusValue);
  }

  /**
   * 既存のステータス文字列から復元する（DBから読み込み時など）
   * バリデーションは行わない（既に保存されているデータは信頼する）
   */
  static reconstruct(value: string): QaStatus {
    return new QaStatus(value as QaStatusValue);
  }

  /**
   * 保留中ステータスを生成（ワークフロー開始待ち）
   */
  static pending(): QaStatus {
    return new QaStatus("pending");
  }

  /**
   * 処理中ステータスを生成
   */
  static processing(): QaStatus {
    return new QaStatus("processing");
  }

  /**
   * 完了ステータスを生成
   */
  static completed(): QaStatus {
    return new QaStatus("completed");
  }

  /**
   * エラーステータスを生成
   */
  static error(): QaStatus {
    return new QaStatus("error");
  }

  /**
   * ステータスの検証
   * @throws ドメインバリデーションエラー - 無効なステータスの場合
   */
  private static validate(value: string): void {
    if (!QA_STATUS_VALUES.includes(value as QaStatusValue)) {
      throw domainValidationError("QA_HISTORY_STATUS_INVALID");
    }
  }

  /**
   * ステータス文字列を取得
   */
  get value(): QaStatusValue {
    return this._value;
  }

  /**
   * 保留中かどうか（ワークフロー開始待ち）
   */
  isPending(): boolean {
    return this._value === "pending";
  }

  /**
   * 処理中かどうか
   */
  isProcessing(): boolean {
    return this._value === "processing";
  }

  /**
   * 完了かどうか
   */
  isCompleted(): boolean {
    return this._value === "completed";
  }

  /**
   * エラーかどうか
   */
  isError(): boolean {
    return this._value === "error";
  }

  /**
   * 等価性の比較
   */
  equals(other: QaStatus): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
