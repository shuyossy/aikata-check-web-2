import { z } from "zod";

/**
 * 全ステップの出力スキーマのベース
 * 全てのワークフローステップはこのスキーマを継承する
 */
export const baseStepOutputSchema = z.object({
  status: z.enum(["success", "failed"]),
  errorMessage: z.string().optional(),
});

export type BaseStepOutput = z.infer<typeof baseStepOutputSchema>;
