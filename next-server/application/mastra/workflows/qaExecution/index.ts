/**
 * Q&A実行ワークフロー
 * ユーザーの質問に対してドキュメントを調査し、回答を生成する
 */

// 型定義
export type {
  QaExecutionWorkflowRuntimeContext,
  QaExecutionTriggerInput,
  ReviewMode,
  AvailableDocument,
  DocumentCache,
  ResearchTask,
  ResearchResult,
  ChecklistResultWithIndividual,
} from "./types";

export {
  qaExecutionTriggerSchema,
  reviewModeSchema,
  availableDocumentSchema,
  documentCacheSchema,
  researchTaskSchema,
  researchResultSchema,
  checklistResultWithIndividualSchema,
} from "./types";

// ヘルパー関数
export {
  judgeReviewMode,
  buildPlanningChecklistInfo,
  buildResearchChecklistInfo,
  buildAnswerChecklistInfo,
} from "./lib";

// メインワークフロー
export {
  qaExecutionWorkflow,
  qaExecutionWorkflowInputSchema,
  qaExecutionWorkflowOutputSchema,
  type QaExecutionWorkflowInput,
  type QaExecutionWorkflowOutput,
} from "./workflow";

// ステップ
export {
  planQaResearchStep,
  planQaResearchStepInputSchema,
  planQaResearchStepOutputSchema,
  type PlanQaResearchStepInput,
  type PlanQaResearchStepOutput,
} from "./steps/planQaResearchStep";

export {
  generateQaAnswerStep,
  generateQaAnswerStepInputSchema,
  generateQaAnswerStepOutputSchema,
  type GenerateQaAnswerStepInput,
  type GenerateQaAnswerStepOutput,
} from "./steps/generateQaAnswerStep";

export {
  getTotalChunksStep,
  getTotalChunksStepInputSchema,
  getTotalChunksStepOutputSchema,
  type GetTotalChunksStepInput,
  type GetTotalChunksStepOutput,
} from "./steps/getTotalChunksStep";

export {
  researchChunkStep,
  researchChunkStepInputSchema,
  researchChunkStepOutputSchema,
  type ResearchChunkStepInput,
  type ResearchChunkStepOutput,
} from "./steps/researchChunkStep";

// リトライ付きドキュメント調査ワークフロー
export {
  researchDocumentWithRetryWorkflow,
  researchDocumentWithRetryInputSchema,
  researchDocumentWithRetryOutputSchema,
  type ResearchDocumentWithRetryInput,
  type ResearchDocumentWithRetryOutput,
} from "./researchDocument";
