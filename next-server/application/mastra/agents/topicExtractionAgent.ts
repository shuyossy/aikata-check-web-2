import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { getTopicExtractionPrompt } from "./prompts";
import { getModel } from "./model";

/**
 * トピック抽出エージェントの出力スキーマ
 */
export const topicExtractionOutputSchema = z.object({
  topics: z.array(
    z.object({
      reason: z
        .string()
        .describe(
          "Reason why this topic is necessary for creating checklist items",
        ),
      title: z.string().describe("Extracted topic"),
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
  instructions: getTopicExtractionPrompt,
  model: getModel,
});
