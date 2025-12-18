import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { getQaPlanningPrompt } from "./prompts";
import type { QaPlanningAgentRuntimeContext } from "./types";

/**
 * Q&A調査計画エージェント
 * ユーザーの質問に答えるために必要なドキュメント調査計画を作成する
 */
export const qaPlanningAgent = new Agent({
  name: "qaPlanningAgent",
  instructions: ({
    runtimeContext,
  }: {
    runtimeContext?: { get: (key: string) => unknown };
  }) =>
    getQaPlanningPrompt({
      runtimeContext: runtimeContext as import("@mastra/core/di").RuntimeContext<QaPlanningAgentRuntimeContext>,
    }),
  model: ({ runtimeContext }) => getModel(runtimeContext),
});
