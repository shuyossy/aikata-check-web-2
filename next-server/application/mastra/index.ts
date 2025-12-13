import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { topicExtractionAgent, topicChecklistAgent } from "./agents";
import { checklistGenerationWorkflow } from "./workflows/checklistGeneration";
import { getLogLevel } from "@/lib/server/logger";

/**
 * Mastraインスタンス
 * AIエージェントとワークフローを管理する
 */
export const mastra = new Mastra({
  logger: new PinoLogger({
    name: "AIKATA",
    level: getLogLevel(),
  }),
  agents: {
    topicExtractionAgent,
    topicChecklistAgent,
  },
  workflows: {
    checklistGenerationWorkflow,
  },
});

export {
  checklistGenerationWorkflow,
  // ファイル関連のスキーマとキー
  rawUploadFileMetaSchema,
  extractedFileSchema,
  FILE_BUFFERS_CONTEXT_KEY,
} from "./workflows/checklistGeneration";
export type {
  ChecklistGenerationOutput,
  TriggerInput,
  // ファイル関連の型
  RawUploadFileMeta,
  ExtractedFile,
  FileBufferData,
  FileBuffersMap,
  Topic,
  ChecklistGenerationWorkflowRuntimeContext,
} from "./workflows/checklistGeneration";

export { topicExtractionAgent, topicChecklistAgent } from "./agents";
export type {
  TopicExtractionOutput,
  TopicChecklistOutput,
} from "./agents";

export { checkWorkflowResult, checkStatuses } from "./lib/workflowUtils";
