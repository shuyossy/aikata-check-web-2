import { createStep } from '@mastra/core/workflows';
import type { RuntimeContext } from '@mastra/core/di';
import { z } from 'zod';
import { baseStepOutputSchema } from '../../schema';
import {
  type QaExecutionWorkflowRuntimeContext,
  researchTaskSchema,
  availableDocumentSchema,
  checklistResultWithIndividualSchema,
} from '../types';
import { judgeReviewMode, buildPlanningChecklistInfo } from '../lib';
import type { QaPlanningAgentRuntimeContext } from '@/application/mastra/agents/types';
import { createRuntimeContext } from '@/application/mastra/lib/agentUtils';
import { normalizeUnknownError } from '@/lib/server/error';
import { getLogger } from '@/lib/server/logger';

const logger = getLogger();

/**
 * 調査計画ステップの入力スキーマ
 */
export const planQaResearchStepInputSchema = z.object({
  question: z.string(),
  availableDocuments: z.array(availableDocumentSchema),
  checklistResults: z.array(checklistResultWithIndividualSchema),
});

export type PlanQaResearchStepInput = z.infer<
  typeof planQaResearchStepInputSchema
>;

/**
 * 調査計画ステップの出力スキーマ
 */
export const planQaResearchStepOutputSchema = baseStepOutputSchema.extend({
  researchTasks: z.array(researchTaskSchema).optional(),
});

export type PlanQaResearchStepOutput = z.infer<
  typeof planQaResearchStepOutputSchema
>;

/**
 * 構造化出力用のスキーマ
 */
const researchTasksSchema = z.object({
  tasks: z.array(
    z.object({
      reasoning: z
        .string()
        .describe('Reason for selecting this document for research'),
      documentId: z.string().describe('Document ID to investigate'),
      researchContent: z
        .string()
        .describe('Detailed research instructions for this document'),
    })
  ),
});

/**
 * 調査計画ステップ
 * ユーザーの質問に答えるために必要なドキュメント調査計画を作成する
 */
export const planQaResearchStep = createStep({
  id: 'planQaResearchStep',
  description: '調査計画を作成するステップ',
  inputSchema: planQaResearchStepInputSchema,
  outputSchema: planQaResearchStepOutputSchema,
  execute: async ({ inputData, bail, mastra, runtimeContext: workflowRuntimeContext }) => {
    try {
      const { question, availableDocuments, checklistResults } = inputData;

      // レビューモードを判定
      const reviewMode = judgeReviewMode(checklistResults);

      // チェックリスト情報の文字列を生成
      const checklistInfo = buildPlanningChecklistInfo(checklistResults);

      // ワークフローRuntimeContextからシステム設定を取得
      const typedWorkflowRuntimeContext = workflowRuntimeContext as
        | RuntimeContext<QaExecutionWorkflowRuntimeContext>
        | undefined;
      const systemApiKey = typedWorkflowRuntimeContext?.get('systemApiKey');
      const systemApiUrl = typedWorkflowRuntimeContext?.get('systemApiUrl');
      const systemApiModel = typedWorkflowRuntimeContext?.get('systemApiModel');

      // RuntimeContext作成（システム設定も含める）
      const runtimeContext =
        createRuntimeContext<QaPlanningAgentRuntimeContext>({
          availableDocuments,
          checklistInfo,
          reviewMode,
          systemApiKey,
          systemApiUrl,
          systemApiModel,
        });

      // Mastraエージェント経由でAI呼び出し（構造化出力）
      const planningAgent = mastra?.getAgent('qaPlanningAgent');
      if (!planningAgent) {
        throw new Error('qaPlanningAgent not found');
      }

      const result = await planningAgent.generateLegacy(question, {
        runtimeContext,
        output: researchTasksSchema,
      });

      // 構造化出力から調査タスクを取得
      const researchTasks = (result.object?.tasks || []).map((task) => ({
        documentCacheId: task.documentId,
        researchContent: task.researchContent,
        reasoning: task.reasoning,
      }));

      if (researchTasks.length === 0) {
        return bail({
          status: 'failed' as const,
          errorMessage: '調査対象ドキュメントが特定できませんでした',
        });
      }

      return {
        status: 'success' as const,
        researchTasks,
      };
    } catch (error) {
      logger.error({ err: error }, '調査計画の作成に失敗しました');
      const normalizedError = normalizeUnknownError(error);
      return bail({
        status: 'failed' as const,
        errorMessage: normalizedError.message,
      });
    }
  },
});
