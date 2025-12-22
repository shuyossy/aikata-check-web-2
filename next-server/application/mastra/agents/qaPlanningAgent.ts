import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { getQaPlanningPrompt } from "./prompts";

/**
 * Q&A調査計画エージェント
 * ユーザーの質問に答えるために必要なドキュメント調査計画を作成する
 */
export const qaPlanningAgent = new Agent({
  name: "qaPlanningAgent",
  instructions: getQaPlanningPrompt,
  model: getModel,
});
