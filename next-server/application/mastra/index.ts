import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import {
  topicExtractionAgent,
  topicChecklistAgent,
  reviewExecuteAgent,
} from "./agents";
import { checklistGenerationWorkflow } from "./workflows/checklistGeneration";
import { reviewExecutionWorkflow } from "./workflows/reviewExecution";
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
    reviewExecuteAgent,
  },
  workflows: {
    checklistGenerationWorkflow,
    reviewExecutionWorkflow,
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
  TriggerInput as ChecklistGenerationTriggerInput,
  // ファイル関連の型
  RawUploadFileMeta,
  ExtractedFile,
  FileBufferData,
  FileBuffersMap,
  Topic,
  ChecklistGenerationWorkflowRuntimeContext,
} from "./workflows/checklistGeneration";

export { reviewExecutionWorkflow } from "./workflows/reviewExecution";
export type {
  ReviewExecutionOutput,
  TriggerInput as ReviewExecutionTriggerInput,
  CheckListItem,
  EvaluationCriterion,
  ReviewSettingsInput,
  SingleReviewResult,
  ReviewExecutionWorkflowRuntimeContext,
} from "./workflows/reviewExecution";

export {
  topicExtractionAgent,
  topicChecklistAgent,
  reviewExecuteAgent,
} from "./agents";
export type {
  TopicExtractionOutput,
  TopicChecklistOutput,
  ReviewResultItem,
  ReviewExecuteOutput,
} from "./agents";

export { checkWorkflowResult, checkStatuses } from "./lib/workflowUtils";
