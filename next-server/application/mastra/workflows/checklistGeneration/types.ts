import { z } from "zod";
import type { BaseRuntimeContext } from "../../types";
import { rawUploadFileMetaSchema, type FileBuffersMap } from "../shared/types";

/**
 * ワークフローのトリガー入力スキーマ
 * クライアントからはメタデータのみ渡し、実際のファイルバッファはRuntimeContext経由で渡す
 */
export const triggerSchema = z.object({
  files: z.array(rawUploadFileMetaSchema),
  checklistRequirements: z.string(),
});

export type TriggerInput = z.infer<typeof triggerSchema>;

/**
 * 抽出されたトピックの型定義
 */
export const topicSchema = z.object({
  title: z.string(),
  reason: z.string(),
});

export type Topic = z.infer<typeof topicSchema>;

/**
 * チェックリスト生成ワークフローのRuntimeContext型定義
 * workflowの実行時にruntimeContextとして渡される
 * BaseRuntimeContextを継承し、共通のプロパティ（employeeId, projectApiKey）を持つ
 * fileBuffersはファイルバッファマップを保持（zodスキーマでシリアライズできないため）
 */
export type ChecklistGenerationWorkflowRuntimeContext = BaseRuntimeContext & {
  fileBuffers?: FileBuffersMap;
};
