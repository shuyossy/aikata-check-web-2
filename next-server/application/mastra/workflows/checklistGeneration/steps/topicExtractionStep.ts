import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import type { RuntimeContext } from '@mastra/core/di';
import {
  topicExtractionAgent,
  topicExtractionOutputSchema as agentOutputSchema,
} from '../../../agents';
import { baseStepOutputSchema } from '../../schema';
import { topicSchema, type ChecklistGenerationWorkflowRuntimeContext } from '../types';
import { extractedFileSchema } from '../../shared';
import { createCombinedMessage } from '../../lib';
import { createRuntimeContext } from '../../../lib/agentUtils';
import { normalizeUnknownError } from '@/lib/server/error';
import type { TopicExtractionAgentRuntimeContext } from '../../../agents';

/**
 * トピック抽出ステップの入力スキーマ
 * fileProcessingStepで処理済みのExtractedFileを受け取る
 */
export const topicExtractionInputSchema = z.object({
  files: z.array(extractedFileSchema),
  checklistRequirements: z.string(),
});

/**
 * トピック抽出ステップの出力スキーマ
 */
export const topicExtractionStepOutputSchema = baseStepOutputSchema.extend({
  topics: z.array(topicSchema).optional(),
  checklistRequirements: z.string().optional(),
});

export type TopicExtractionInput = z.infer<typeof topicExtractionInputSchema>;
export type TopicExtractionStepOutput = z.infer<
  typeof topicExtractionStepOutputSchema
>;

/**
 * トピック抽出ステップ
 * ドキュメントから独立したトピックを抽出する
 */
export const topicExtractionStep = createStep({
  id: 'topic-extraction',
  description: 'ドキュメントからトピックを抽出する',
  inputSchema: topicExtractionInputSchema,
  outputSchema: topicExtractionStepOutputSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
  }): Promise<TopicExtractionStepOutput> => {
    try {
      const { files, checklistRequirements } = inputData;

      // workflowのRuntimeContextからemployeeIdとprojectApiKey、システム設定を取得
      const typedWorkflowRuntimeContext = workflowRuntimeContext as
        | RuntimeContext<ChecklistGenerationWorkflowRuntimeContext>
        | undefined;
      const employeeId = typedWorkflowRuntimeContext?.get('employeeId');
      const projectApiKey = typedWorkflowRuntimeContext?.get('projectApiKey');
      const systemApiKey = typedWorkflowRuntimeContext?.get('systemApiKey');
      const systemApiUrl = typedWorkflowRuntimeContext?.get('systemApiUrl');
      const systemApiModel = typedWorkflowRuntimeContext?.get('systemApiModel');

      // エージェント用のRuntimeContextを作成（employeeIdとprojectApiKey、システム設定を引き継ぐ）
      const runtimeContext =
        createRuntimeContext<TopicExtractionAgentRuntimeContext>({
          checklistRequirements,
          projectApiKey,
          employeeId,
          systemApiKey,
          systemApiUrl,
          systemApiModel,
        });

      // メッセージコンテンツを作成
      const messageContent = createCombinedMessage(
        files,
        'Please analyze the following documents and extract independent topics for checklist creation'
      );

      // エージェントを実行（generateLegacyを使用）
      const result = await topicExtractionAgent.generateLegacy(
        {
          role: 'user',
          content: messageContent,
        },
        {
          output: agentOutputSchema,
          runtimeContext,
        }
      );

      // 構造化出力を取得
      const output = result.object;

      if (!output || !output.topics || output.topics.length === 0) {
        return {
          status: 'failed',
          errorMessage: 'トピックを抽出できませんでした',
        };
      }

      return {
        status: 'success',
        topics: output.topics,
        checklistRequirements,
      };
    } catch (error) {
      // エラーを正規化して統一的に処理
      const normalizedError = normalizeUnknownError(error);
      return {
        status: 'failed',
        errorMessage: normalizedError.message,
      };
    }
  },
});
