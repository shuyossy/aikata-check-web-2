import type { EvaluationCriterionItem } from "@/components/reviewSpace";

/**
 * 評価基準が有効かどうかを検証する
 * @param criteria 評価基準の配列
 * @returns 有効な場合はtrue、無効な場合はfalse
 */
export function validateEvaluationCriteria(
  criteria: EvaluationCriterionItem[]
): boolean {
  // 空の配列は無効
  if (criteria.length === 0) return false;

  // 全ての項目がラベルと説明の両方を持っているか確認
  return criteria.every(
    (c) => c.label.trim() !== "" && c.description.trim() !== ""
  );
}
