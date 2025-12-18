import { createWorkflow } from '@mastra/core/workflows';
import type { RuntimeContext } from '@mastra/core/di';
import { z } from 'zod';
import {
  QaExecutionWorkflowRuntimeContext,
  checklistResultWithIndividualSchema,
  availableDocumentSchema,
} from './types';
import { planQaResearchStep } from './steps/planQaResearchStep';
import { generateQaAnswerStep, generateQaAnswerStepOutputSchema } from './steps/generateQaAnswerStep';
import {
  researchDocumentWithRetryWorkflow,
  researchDocumentWithRetryInputSchema,
} from './researchDocument';
import type { QaResearchStartEvent, QaResearchProgressEvent } from '@/application/shared/port/push/QaSseEventTypes';

/**
 * Q&A実行ワークフローの入力スキーマ
 */
export const qaExecutionWorkflowInputSchema = z.object({
  /** ユーザーの質問 */
  question: z.string(),
  /** 利用可能なドキュメント */
  availableDocuments: z.array(availableDocumentSchema),
  /** チェックリスト結果（個別結果含む） */
  checklistResults: z.array(checklistResultWithIndividualSchema),
});

export type QaExecutionWorkflowInput = z.infer<typeof qaExecutionWorkflowInputSchema>;

/**
 * Q&A実行ワークフローの出力スキーマ
 */
export const qaExecutionWorkflowOutputSchema = generateQaAnswerStepOutputSchema;

export type QaExecutionWorkflowOutput = z.infer<typeof qaExecutionWorkflowOutputSchema>;

/**
 * Q&A実行ワークフロー
 * ユーザーの質問に対してドキュメントを調査し、回答を生成する
 *
 * 処理フロー:
 * 1. planQaResearchStep: 調査計画を作成
 * 2. foreach(researchDocumentWithRetryWorkflow): ドキュメントを並列調査
 * 3. generateQaAnswerStep: 回答を生成
 */
export const qaExecutionWorkflow = createWorkflow({
  id: 'qaExecutionWorkflow',
  inputSchema: qaExecutionWorkflowInputSchema,
  outputSchema: qaExecutionWorkflowOutputSchema,
})
  .then(planQaResearchStep)
  .map(async ({ inputData, bail, getInitData, runtimeContext }) => {
    if (inputData.status === 'failed') {
      return bail(inputData);
    }

    const initData = (await getInitData()) as z.infer<typeof qaExecutionWorkflowInputSchema>;
    const ctx = runtimeContext as RuntimeContext<QaExecutionWorkflowRuntimeContext>;
    const eventBroker = ctx.get('eventBroker');
    const qaHistoryId = ctx.get('qaHistoryId');

    // ドキュメント名を取得するためのマップを作成
    const documentNameMap = new Map(
      initData.availableDocuments.map((doc) => [doc.id, doc.fileName])
    );

    // 調査開始イベントをブロードキャスト（全購読者に配信）
    if (eventBroker && qaHistoryId) {
      const researchStartEvent: QaResearchStartEvent = {
        type: 'research_start',
        data: {
          tasks: (inputData.researchTasks || []).map((task) => ({
            documentName: documentNameMap.get(task.documentCacheId) || '',
            researchContent: task.researchContent,
          })),
        },
      };
      eventBroker.broadcast(`qa:${qaHistoryId}`, researchStartEvent);

      // 各ドキュメントの調査開始（in_progress）イベントをブロードキャスト
      for (const task of inputData.researchTasks || []) {
        const progressEvent: QaResearchProgressEvent = {
          type: 'research_progress',
          data: {
            documentName: documentNameMap.get(task.documentCacheId) || '',
            status: 'in_progress',
          },
        };
        eventBroker.broadcast(`qa:${qaHistoryId}`, progressEvent);
      }
    }

    // researchDocumentWithRetryWorkflowの入力形式に変換
    return (inputData.researchTasks || []).map((task) => ({
      documentCacheId: task.documentCacheId,
      researchContent: task.researchContent,
      reasoning: task.reasoning,
      question: initData.question,
      checklistResults: initData.checklistResults,
    })) as z.infer<typeof researchDocumentWithRetryInputSchema>[];
  })
  .foreach(researchDocumentWithRetryWorkflow, { concurrency: 5 })
  .map(async ({ inputData, bail, getInitData }) => {
    // 注：各ドキュメントの調査進捗イベントはresearchDocumentWithRetryWorkflow内で発行済み

    // 失敗があればエラー
    if (inputData.some((item) => item.status === 'failed')) {
      const failed = inputData.find((item) => item.status === 'failed');
      return bail({
        status: 'failed' as const,
        errorMessage: failed?.errorMessage || '調査に失敗しました',
      });
    }

    const initData = (await getInitData()) as z.infer<typeof qaExecutionWorkflowInputSchema>;

    // generateQaAnswerStepの入力形式に変換
    const researchResults = inputData
      .filter((item) => item.status === 'success' && item.researchResult)
      .map((item) => ({
        documentCacheId: item.documentCacheId!,
        documentName: item.documentName!,
        researchContent: item.researchContent!,
        researchResult: item.researchResult!,
      }));

    return {
      question: initData.question,
      checklistResults: initData.checklistResults,
      researchResults,
    };
  })
  .then(generateQaAnswerStep)
  .commit();
