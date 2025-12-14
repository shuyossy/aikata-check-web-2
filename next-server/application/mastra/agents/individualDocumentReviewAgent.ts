import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { getIndividualDocumentReviewPrompt } from "./prompts";
import { getModel } from "./model";
import type { IndividualDocumentReviewAgentRuntimeContext } from "./types";

/**
 * 個別ドキュメントレビュー結果の単一項目スキーマ
 * 大量レビュー時の各ドキュメント（またはチャンク）に対するレビュー結果
 * 評定は含まず、コメントのみを出力する（評定は統合ステップで付与）
 */
export const individualDocumentReviewResultItemSchema = z.object({
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
  comment: z.string().describe("review comment for this document part"),
});

/**
 * 個別ドキュメントレビューエージェントの出力スキーマ
 */
export const individualDocumentReviewOutputSchema = z.array(
  individualDocumentReviewResultItemSchema,
);

export type IndividualDocumentReviewResultItem = z.infer<
  typeof individualDocumentReviewResultItemSchema
>;
export type IndividualDocumentReviewOutput = z.infer<
  typeof individualDocumentReviewOutputSchema
>;

/**
 * 個別ドキュメントレビューエージェント
 * 大量レビュー時に各ドキュメント（またはドキュメントの一部）をレビューする
 * 評定は付与せず、コメントのみを生成する
 */
export const individualDocumentReviewAgent = new Agent({
  name: "individual-document-review-agent",
  instructions: ({
    runtimeContext,
  }: {
    runtimeContext?: { get: (key: string) => unknown };
  }) =>
    getIndividualDocumentReviewPrompt({
      runtimeContext: runtimeContext as
        | import("@mastra/core/di").RuntimeContext<IndividualDocumentReviewAgentRuntimeContext>
        | undefined,
    }),
  model: ({ runtimeContext }) => getModel(runtimeContext),
});
