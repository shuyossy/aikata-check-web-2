// Mastra AgentにてAIモデルを動的に作成するためのRuntimeContext
// runtimeContextはmodel, tools, promptの設定やworkflowで活用可能
// https://mastra.ai/ja/docs/agents/dynamic-agents
import type { BaseRuntimeContext } from "../types";

// 再エクスポート（エージェント固有の型と共に使用可能にする）
export type { BaseRuntimeContext } from "../types";

/**
 * トピック抽出エージェントのRuntimeContext型定義
 */
export type TopicExtractionAgentRuntimeContext = BaseRuntimeContext & {
  checklistRequirements?: string;
  [key: string]: unknown;
};

/**
 * トピック別チェックリスト生成エージェントのRuntimeContext型定義
 */
export type TopicChecklistAgentRuntimeContext = BaseRuntimeContext & {
  topic: {
    title: string;
    reason: string;
  };
  checklistRequirements?: string;
  [key: string]: unknown;
};

/**
 * 評価項目の定義
 */
export interface EvaluationCriterionItem {
  label: string;
  description: string;
}

/**
 * レビュー実行エージェントのRuntimeContext型定義
 */
export type ReviewExecuteAgentRuntimeContext = BaseRuntimeContext & {
  checklistItems: { id: string; content: string }[];
  additionalInstructions?: string;
  commentFormat?: string;
  evaluationCriteria?: EvaluationCriterionItem[];
  [key: string]: unknown;
};

/**
 * チェックリストカテゴリ分類エージェントのRuntimeContext型定義
 */
export type ChecklistCategoryAgentRuntimeContext = BaseRuntimeContext & {
  maxChecklistsPerCategory: number;
  maxCategories: number;
  [key: string]: unknown;
};
