import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { getReviewExecutionPrompt } from "./prompts";
import { getModel } from "./model";

/**
 * レビュー実行エージェントの単一結果スキーマ
 */
export const reviewResultItemSchema = z.object({
  checklistId: z.string().describe("チェック項目のID"),
  // CoTのようにAIにどのファイルのどのセクションをレビューするべきかを考えさせるための隠しフィールド
  reviewSections: z
    .array(
      z.object({
        fileName: z.string().describe("file name to review"),
        sectionNames: z.array(
          z.string().describe("section name within the file"),
        ),
      }),
    )
    .describe(
      "files and sections that should be reviewed for evaluation and commenting",
    ),
  comment: z.string().describe("evaluation comment"),
  evaluation: z.string().describe("evaluation label"),
});

/**
 * レビュー実行エージェントの出力スキーマ
 */
export const reviewExecuteOutputSchema = z.array(reviewResultItemSchema);

export type ReviewResultItem = z.infer<typeof reviewResultItemSchema>;
export type ReviewExecuteOutput = z.infer<typeof reviewExecuteOutputSchema>;

/**
 * レビュー実行エージェント
 * ドキュメントをチェック項目に基づいて評価する
 */
export const reviewExecuteAgent = new Agent({
  name: "review-execute-agent",
  instructions: getReviewExecutionPrompt,
  model: getModel,
});
