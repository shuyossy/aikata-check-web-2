import { Agent } from "@mastra/core/agent";
import { getModel } from "./model";
import { z } from "zod";
import { getChecklistRefinementPrompt } from "./prompts";

/**
 * チェックリストブラッシュアップエージェントの出力スキーマ
 */
export const checklistRefinementOutputSchema = z.object({
  refinedChecklists: z
    .array(z.string().describe("Refined checklist item"))
    .describe("Refined and consolidated checklist items"),
});

export type ChecklistRefinementOutput = z.infer<
  typeof checklistRefinementOutputSchema
>;

/**
 * チェックリストブラッシュアップエージェント
 * 生成されたチェックリスト項目の重複削除・結合を行う
 */
export const checklistRefinementAgent = new Agent({
  name: "checklist-refinement-agent",
  instructions: getChecklistRefinementPrompt,
  model: getModel,
});
