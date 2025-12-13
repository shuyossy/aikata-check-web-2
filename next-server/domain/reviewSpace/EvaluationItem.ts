import { domainValidationError } from "@/lib/server/error";

/**
 * 評定項目のプロパティ
 */
export interface EvaluationItemProps {
  label: string;
  description: string;
}

/**
 * 評定項目値オブジェクト
 * レビュー結果の評定ラベル（例: A, B, C, -）と説明を管理
 */
export class EvaluationItem {
  private static readonly MAX_LABEL_LENGTH = 10;
  private static readonly MAX_DESCRIPTION_LENGTH = 200;

  private readonly _label: string;
  private readonly _description: string;

  private constructor(label: string, description: string) {
    this._label = label;
    this._description = description;
  }

  /**
   * 新規評定項目を生成する
   * @throws ドメインバリデーションエラー - ラベルまたは説明が不正な場合
   */
  static create(props: EvaluationItemProps): EvaluationItem {
    EvaluationItem.validateLabel(props.label);
    EvaluationItem.validateDescription(props.description);
    return new EvaluationItem(props.label, props.description);
  }

  /**
   * 既存データから復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(props: EvaluationItemProps): EvaluationItem {
    return new EvaluationItem(props.label, props.description);
  }

  /**
   * ラベルの検証
   * @throws ドメインバリデーションエラー - ラベルが不正な場合
   */
  private static validateLabel(label: string): void {
    if (!label || !label.trim()) {
      throw domainValidationError("EVALUATION_LABEL_EMPTY");
    }

    if (label.length > EvaluationItem.MAX_LABEL_LENGTH) {
      throw domainValidationError("EVALUATION_LABEL_TOO_LONG");
    }
  }

  /**
   * 説明の検証
   * @throws ドメインバリデーションエラー - 説明が不正な場合
   */
  private static validateDescription(description: string): void {
    if (!description || !description.trim()) {
      throw domainValidationError("EVALUATION_DESCRIPTION_EMPTY");
    }

    if (description.length > EvaluationItem.MAX_DESCRIPTION_LENGTH) {
      throw domainValidationError("EVALUATION_DESCRIPTION_TOO_LONG");
    }
  }

  /**
   * ラベルを取得
   */
  get label(): string {
    return this._label;
  }

  /**
   * 説明を取得
   */
  get description(): string {
    return this._description;
  }

  /**
   * JSON形式に変換
   */
  toJSON(): EvaluationItemProps {
    return {
      label: this._label,
      description: this._description,
    };
  }

  /**
   * 等価性の比較
   */
  equals(other: EvaluationItem): boolean {
    return this._label === other._label && this._description === other._description;
  }
}
