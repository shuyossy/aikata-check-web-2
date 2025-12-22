import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { z } from "zod";
import { getTopicChecklistCreationPrompt } from "./prompts";

/**
 * トピック別チェックリスト生成エージェントの出力スキーマ
 */
export const topicChecklistOutputSchema = z.object({
  checklistItems: z.array(z.string().describe("Checklist item")),
  reason: z.string().describe("Reason why this checklist item is valuable"),
});

export type TopicChecklistOutput = z.infer<typeof topicChecklistOutputSchema>;

/**
 * トピック別チェックリスト生成エージェント
 * 特定のトピックに対してチェックリスト項目を生成する
 */
export const topicChecklistAgent = new Agent({
  name: "topic-checklist-agent",
  instructions: getTopicChecklistCreationPrompt,
  model: getModel,
});
