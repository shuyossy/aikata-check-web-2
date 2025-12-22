/**
 * Q&A実行ワークフローで利用するヘルパー関数
 */

import type { ChecklistResultWithIndividual, ReviewMode } from "./types";

/**
 * レビューモードを判定する
 * 個別レビュー結果が存在する場合は大量レビュー（large）
 * @param checklistResults チェックリスト結果と個別レビュー結果の配列
 * @returns 'large' | 'small'
 */
export function judgeReviewMode(
  checklistResults: ChecklistResultWithIndividual[],
): ReviewMode {
  const hasIndividualResults = checklistResults.some(
    (item) => item.individualResults && item.individualResults.length > 0,
  );
  return hasIndividualResults ? "large" : "small";
}

/**
 * 詳細なチェックリスト情報を構築する（内部共通関数）
 * 調査計画用・ドキュメント調査用で共通のフォーマットを使用
 *
 * @param checklistResults チェックリスト結果と個別レビュー結果の配列
 * @returns チェックリスト情報のテキスト
 */
function buildDetailedChecklistInfo(
  checklistResults: ChecklistResultWithIndividual[],
): string {
  return checklistResults
    .map((item) => {
      let info = `Checklist ID: ${item.checklistResult.id}\nContent: ${item.checklistResult.content}\n`;
      if (item.checklistResult.evaluation || item.checklistResult.comment) {
        info += `Review Result:\n  Evaluation: ${item.checklistResult.evaluation || "N/A"}\n  Comment: ${item.checklistResult.comment || "N/A"}\n`;
      }
      if (item.individualResults && item.individualResults.length > 0) {
        info += `Individual Review Results:\n`;
        item.individualResults.forEach((result) => {
          info += `  - Document ID: ${result.documentId}\n    Document Name: ${result.individualFileName}\n    Comment: ${result.comment}\n`;
        });
      }
      return info;
    })
    .join("\n---\n");
}

/**
 * 調査計画用のチェックリスト情報を構築する
 * @param checklistResults チェックリスト結果と個別レビュー結果の配列
 * @returns チェックリスト情報のテキスト
 */
export function buildPlanningChecklistInfo(
  checklistResults: ChecklistResultWithIndividual[],
): string {
  return buildDetailedChecklistInfo(checklistResults);
}

/**
 * ドキュメント調査用のチェックリスト情報を構築する
 * @param checklistResults チェックリスト結果と個別レビュー結果の配列
 * @returns チェックリスト情報のテキスト
 */
export function buildResearchChecklistInfo(
  checklistResults: ChecklistResultWithIndividual[],
): string {
  return buildDetailedChecklistInfo(checklistResults);
}

/**
 * 回答生成用のチェックリスト情報を構築する
 * @param checklistResults チェックリスト結果と個別レビュー結果の配列
 * @returns チェックリスト情報のテキスト
 */
export function buildAnswerChecklistInfo(
  checklistResults: ChecklistResultWithIndividual[],
): string {
  return checklistResults
    .map((item) => {
      let info = `Checklist: ${item.checklistResult.content}\n`;
      if (item.checklistResult.evaluation || item.checklistResult.comment) {
        info += `Evaluation: ${item.checklistResult.evaluation || "N/A"}, Comment: ${item.checklistResult.comment || "N/A"}`;
      }
      return info;
    })
    .join("\n");
}

// チャンク分割関数は @/application/mastra/lib/util.ts を使用すること
// - makeChunksByCount
// - splitTextByCount
// - splitImagesByCount
