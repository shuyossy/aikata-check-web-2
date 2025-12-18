import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { getQaAnswerPrompt } from "./prompts";
import type { QaAnswerAgentRuntimeContext } from "./types";

/**
 * Q&A回答生成エージェント
 * 調査結果を統合してユーザーの質問に回答する
 */
export const qaAnswerAgent = new Agent({
  name: "qaAnswerAgent",
  instructions: ({
    runtimeContext,
  }: {
    runtimeContext?: { get: (key: string) => unknown };
  }) =>
    getQaAnswerPrompt({
      runtimeContext: runtimeContext as import("@mastra/core/di").RuntimeContext<QaAnswerAgentRuntimeContext>,
    }),
  model: ({ runtimeContext }) => getModel(runtimeContext),
});
