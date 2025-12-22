import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { getChecklistCategorizePrompt } from "./prompts";
import { getModel } from "./model";

/**
 * カテゴリ分類エージェントの出力スキーマ
 */
export const checklistCategoryOutputSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().describe("Category name"),
        checklistIds: z
          .array(z.number())
          .describe("Array of checklist IDs belonging to the category"),
      }),
    )
    .describe("Classified categories"),
});

export type ChecklistCategoryOutput = z.infer<
  typeof checklistCategoryOutputSchema
>;

/**
 * チェックリストカテゴリ分類エージェント
 * チェックリストを意味的にカテゴリ分類する
 */
export const checklistCategoryAgent = new Agent({
  name: "checklist-category-agent",
  instructions: getChecklistCategorizePrompt,
  model: getModel,
});
