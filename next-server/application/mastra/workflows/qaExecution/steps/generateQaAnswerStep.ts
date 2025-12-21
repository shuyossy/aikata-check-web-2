import { createStep } from '@mastra/core/workflows';
import type { RuntimeContext } from '@mastra/core/di';
import { z } from 'zod';
import { baseStepOutputSchema } from '../../schema';
import {
  type QaExecutionWorkflowRuntimeContext,
  researchResultSchema,
  checklistResultWithIndividualSchema,
} from '../types';
import { judgeReviewMode, buildAnswerChecklistInfo } from '../lib';
import type { QaAnswerAgentRuntimeContext } from '@/application/mastra/agents/types';
import { createRuntimeContext } from '@/application/mastra/lib/agentUtils';
import type { IEventBroker } from '@/application/shared/port/push/IEventBroker';
import type { QaAnswerChunkEvent } from '@/application/shared/port/push/QaSseEventTypes';
import { normalizeUnknownError, workflowError } from '@/lib/server/error';
import { getLogger } from '@/lib/server/logger';

const logger = getLogger();

/**
 * 回答生成ステップの入力スキーマ
 */
export const generateQaAnswerStepInputSchema = z.object({
  question: z.string(),
  checklistResults: z.array(checklistResultWithIndividualSchema),
  researchResults: z.array(researchResultSchema),
});

export type GenerateQaAnswerStepInput = z.infer<
  typeof generateQaAnswerStepInputSchema
>;

/**
 * 回答生成ステップの出力スキーマ
 */
export const generateQaAnswerStepOutputSchema = baseStepOutputSchema.extend({
  answer: z.string().optional(),
  researchSummary: z.array(researchResultSchema).optional(),
});

export type GenerateQaAnswerStepOutput = z.infer<
  typeof generateQaAnswerStepOutputSchema
>;

/**
 * 回答生成ステップ
 * 調査結果を統合してユーザーの質問に回答する
 */
export const generateQaAnswerStep = createStep({
  id: 'generateQaAnswerStep',
  description: '最終回答を生成するステップ',
  inputSchema: generateQaAnswerStepInputSchema,
  outputSchema: generateQaAnswerStepOutputSchema,
  execute: async ({
    inputData,
    bail,
    mastra,
    runtimeContext: workflowRuntimeContext,
  }) => {
    try {
      const { question, checklistResults, researchResults } = inputData;

      // WorkflowのRuntimeContextから各種設定を取得
      const typedWorkflowRuntimeContext = workflowRuntimeContext as
        | RuntimeContext<QaExecutionWorkflowRuntimeContext>
        | undefined;
      const eventBroker = typedWorkflowRuntimeContext?.get?.('eventBroker') as IEventBroker | undefined;
      const userId = typedWorkflowRuntimeContext?.get?.('userId') as string | undefined;
      const qaHistoryId = typedWorkflowRuntimeContext?.get?.('qaHistoryId') as string | undefined;
      const aiApiKey = typedWorkflowRuntimeContext?.get('aiApiKey');
      const aiApiUrl = typedWorkflowRuntimeContext?.get('aiApiUrl');
      const aiApiModel = typedWorkflowRuntimeContext?.get('aiApiModel');

      // レビューモードを判定
      const reviewMode = judgeReviewMode(checklistResults);

      // チェックリスト情報の文字列を生成
      const checklistInfo = buildAnswerChecklistInfo(checklistResults);

      // 調査結果を統合
      const researchSummary = researchResults
        .map(
          (result) =>
            `Document: ${result.documentName}\nResearch Findings:\n${result.researchResult}`
        )
        .join('\n\n---\n\n');

      // RuntimeContext作成
      const runtimeContext = createRuntimeContext<QaAnswerAgentRuntimeContext>({
        userQuestion: question,
        checklistInfo,
        reviewMode,
        aiApiKey,
        aiApiUrl,
        aiApiModel,
      });

      const promptText = `User Question: ${question}\n\nResearch Findings:\n${researchSummary}`;

      // Mastraエージェント経由でAI呼び出し
      const answerAgent = mastra?.getAgent('qaAnswerAgent');
      if (!answerAgent) {
        throw workflowError("WORKFLOW_AGENT_NOT_FOUND");
      }

      // ストリーミング対応でAI呼び出し
      let fullAnswer = '';
      const result = await answerAgent.generateLegacy(promptText, {
        runtimeContext,
        onStepFinish: (stepResult) => {
          // SSEでチャンクを送信
          if (stepResult.text && eventBroker && userId && qaHistoryId) {
            const chunkEvent: QaAnswerChunkEvent = {
              type: 'answer_chunk',
              data: { text: stepResult.text },
            };
            eventBroker.publish(userId, `qa:${qaHistoryId}`, chunkEvent);
          }
          if (stepResult.text) {
            fullAnswer += stepResult.text;
          }
        },
      });

      return {
        status: 'success' as const,
        answer: result.text || fullAnswer,
        researchSummary: researchResults,
      };
    } catch (error) {
      logger.error({ err: error }, '最終回答の生成に失敗しました');
      const normalizedError = normalizeUnknownError(error);
      return bail({
        status: 'failed' as const,
        errorMessage: normalizedError.message,
      });
    }
  },
});
