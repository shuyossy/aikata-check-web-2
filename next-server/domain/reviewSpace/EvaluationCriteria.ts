import { domainValidationError } from "@/lib/server/error";
import { EvaluationItem, EvaluationItemProps } from "./EvaluationItem";

/**
 * デフォルトの評定基準
 */
export const DEFAULT_EVALUATION_CRITERIA: EvaluationItemProps[] = [
  { label: "A", description: "基準を完全に満たしている" },
  { label: "B", description: "基準をある程度満たしている" },
  { label: "C", description: "基準を満たしていない" },
  { label: "-", description: "評価の対象外、または評価できない" },
];

/**
 * 評定基準値オブジェクト
 * 複数の評定項目を管理するコレクション
 */
export class EvaluationCriteria {
  private static readonly MIN_ITEMS = 1;
  private static readonly MAX_ITEMS = 10;

  private readonly _items: EvaluationItem[];

  private constructor(items: EvaluationItem[]) {
    this._items = items;
  }

  /**
   * 新規評定基準を生成する
   * @throws ドメインバリデーションエラー - 項目が不正な場合
   */
  static create(items: EvaluationItemProps[]): EvaluationCriteria {
    EvaluationCriteria.validateItems(items);

    // 各項目をEvaluationItemとして生成（バリデーション含む）
    const evaluationItems = items.map((item) => EvaluationItem.create(item));

    // ラベルの重複チェック
    EvaluationCriteria.validateNoDuplicateLabels(evaluationItems);

    return new EvaluationCriteria(evaluationItems);
  }

  /**
   * デフォルトの評定基準を生成する
   */
  static createDefault(): EvaluationCriteria {
    return EvaluationCriteria.create(DEFAULT_EVALUATION_CRITERIA);
  }

  /**
   * 既存データから復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(items: EvaluationItemProps[]): EvaluationCriteria {
    const evaluationItems = items.map((item) =>
      EvaluationItem.reconstruct(item),
    );
    return new EvaluationCriteria(evaluationItems);
  }

  /**
   * JSONから復元する
   */
  static fromJSON(items: EvaluationItemProps[]): EvaluationCriteria {
    return EvaluationCriteria.reconstruct(items);
  }

  /**
   * 項目数の検証
   */
  private static validateItems(items: EvaluationItemProps[]): void {
    if (!items || items.length < EvaluationCriteria.MIN_ITEMS) {
      throw domainValidationError("EVALUATION_CRITERIA_EMPTY");
    }

    if (items.length > EvaluationCriteria.MAX_ITEMS) {
      throw domainValidationError("EVALUATION_CRITERIA_TOO_MANY");
    }
  }

  /**
   * ラベル重複チェック
   */
  private static validateNoDuplicateLabels(items: EvaluationItem[]): void {
    const labels = items.map((item) => item.label);
    const uniqueLabels = new Set(labels);

    if (labels.length !== uniqueLabels.size) {
      throw domainValidationError("EVALUATION_CRITERIA_DUPLICATE_LABEL");
    }
  }

  /**
   * 評定項目一覧を取得
   */
  get items(): EvaluationItem[] {
    return [...this._items];
  }

  /**
   * JSON形式に変換
   */
  toJSON(): EvaluationItemProps[] {
    return this._items.map((item) => item.toJSON());
  }

  /**
   * 等価性の比較
   */
  equals(other: EvaluationCriteria): boolean {
    if (this._items.length !== other._items.length) {
      return false;
    }

    return this._items.every((item, index) => item.equals(other._items[index]));
  }
}
