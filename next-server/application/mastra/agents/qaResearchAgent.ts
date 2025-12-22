import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { getQaResearchPrompt } from "./prompts";

/**
 * Q&Aドキュメント調査エージェント
 * 特定のドキュメント（またはチャンク）の内容を調査する
 */
export const qaResearchAgent = new Agent({
  name: "qaResearchAgent",
  instructions: getQaResearchPrompt,
  model: getModel,
});
