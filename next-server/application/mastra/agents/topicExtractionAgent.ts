import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { getTopicExtractionPrompt } from "./prompts";
import { getModel } from "./model";
import type { TopicExtractionAgentRuntimeContext } from "./types";

/**
 * トピック抽出エージェントの出力スキーマ
 */
export const topicExtractionOutputSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string().describe("トピックのタイトル"),
      reason: z.string().describe("このトピックが必要な理由"),
    }),
  ),
});

export type TopicExtractionOutput = z.infer<typeof topicExtractionOutputSchema>;

/**
 * トピック抽出エージェント
 * ドキュメントから独立したトピックを抽出する
 */
export const topicExtractionAgent = new Agent({
  name: "topic-extraction-agent",
  instructions: ({
    runtimeContext,
  }: {
    runtimeContext?: { get: (key: string) => unknown };
  }) =>
    getTopicExtractionPrompt({
      runtimeContext: runtimeContext as
        | import("@mastra/core/di").RuntimeContext<TopicExtractionAgentRuntimeContext>
        | undefined,
    }),
  model: ({ runtimeContext }) => getModel(runtimeContext),
});
