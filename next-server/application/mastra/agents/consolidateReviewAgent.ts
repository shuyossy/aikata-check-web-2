import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { getConsolidateReviewPrompt } from "./prompts";
import { getModel } from "./model";

/**
 * レビュー結果統合の単一項目スキーマ
 * 評定とコメントを含む最終的なレビュー結果
 */
export const consolidateReviewResultItemSchema = z.object({
  checklistId: z.number().describe("Checklist item ID (sequential number)"),
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
  comment: z.string().describe("consolidated evaluation comment"),
  evaluation: z.string().describe("evaluation label"),
});

/**
 * レビュー結果統合エージェントの出力スキーマ
 */
export const consolidateReviewOutputSchema = z.array(
  consolidateReviewResultItemSchema,
);

export type ConsolidateReviewResultItem = z.infer<
  typeof consolidateReviewResultItemSchema
>;
export type ConsolidateReviewOutput = z.infer<
  typeof consolidateReviewOutputSchema
>;

/**
 * レビュー結果統合エージェント
 * 個別ドキュメントレビューの結果を統合して最終評価を生成する
 */
export const consolidateReviewAgent = new Agent({
  name: "consolidate-review-agent",
  instructions: getConsolidateReviewPrompt,
  model: getModel,
});
