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
