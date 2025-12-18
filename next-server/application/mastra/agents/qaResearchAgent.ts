import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { getQaResearchPrompt } from "./prompts";
import type { QaResearchAgentRuntimeContext } from "./types";

/**
 * Q&Aドキュメント調査エージェント
 * 特定のドキュメント（またはチャンク）の内容を調査する
 */
export const qaResearchAgent = new Agent({
  name: "qaResearchAgent",
  instructions: ({
    runtimeContext,
  }: {
    runtimeContext?: { get: (key: string) => unknown };
  }) =>
    getQaResearchPrompt({
      runtimeContext: runtimeContext as import("@mastra/core/di").RuntimeContext<QaResearchAgentRuntimeContext>,
    }),
  model: ({ runtimeContext }) => getModel(runtimeContext),
});
