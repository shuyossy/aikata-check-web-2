import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { getQaAnswerPrompt } from "./prompts";

/**
 * Q&A回答生成エージェント
 * 調査結果を統合してユーザーの質問に回答する
 */
export const qaAnswerAgent = new Agent({
  name: "qaAnswerAgent",
  instructions: getQaAnswerPrompt,
  model: getModel,
});
