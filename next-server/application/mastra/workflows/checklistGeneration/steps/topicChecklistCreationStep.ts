import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import type { RuntimeContext } from '@mastra/core/di';
import {
  topicChecklistAgent,
  topicChecklistOutputSchema,
} from '../../../agents';
import { baseStepOutputSchema } from '../../schema';
import { topicSchema, type ChecklistGenerationWorkflowRuntimeContext } from '../types';
import { extractedFileSchema } from '../../shared';
import { createCombinedMessage } from '../../lib';
import { createRuntimeContext } from '../../../lib/agentUtils';
import { normalizeUnknownError } from '@/lib/server/error';
import type { TopicChecklistAgentRuntimeContext } from '../../../agents';

/**
 * トピック別チェックリスト生成ステップの入力スキーマ
 * fileProcessingStepで処理済みのExtractedFileを受け取る
 */
export const topicChecklistInputSchema = z.object({
  topic: topicSchema,
  checklistRequirements: z.string().optional(),
  files: z.array(extractedFileSchema),
});

/**
 * トピック別チェックリスト生成ステップの出力スキーマ
 */
export const topicChecklistOutputStepSchema = baseStepOutputSchema.extend({
  checklistItems: z.array(z.string()).optional(),
  topicTitle: z.string().optional(),
});

export type TopicChecklistInput = z.infer<typeof topicChecklistInputSchema>;
export type TopicChecklistStepOutput = z.infer<
  typeof topicChecklistOutputStepSchema
>;

/**
 * トピック別チェックリスト生成ステップ
 * 特定のトピックに対してチェックリスト項目を生成する
 */
export const topicChecklistCreationStep = createStep({
  id: 'topic-checklist-creation',
  description: 'トピックからチェックリスト項目を生成する',
  inputSchema: topicChecklistInputSchema,
  outputSchema: topicChecklistOutputStepSchema,
  execute: async ({
    inputData,
    runtimeContext: workflowRuntimeContext,
  }): Promise<TopicChecklistStepOutput> => {
    try {
      const { topic, checklistRequirements, files } = inputData;

      // workflowのRuntimeContextから確定済みのAI API設定を取得
      const typedWorkflowRuntimeContext = workflowRuntimeContext as
        | RuntimeContext<ChecklistGenerationWorkflowRuntimeContext>
        | undefined;
      const employeeId = typedWorkflowRuntimeContext?.get('employeeId');
      const aiApiKey = typedWorkflowRuntimeContext?.get('aiApiKey');
      const aiApiUrl = typedWorkflowRuntimeContext?.get('aiApiUrl');
      const aiApiModel = typedWorkflowRuntimeContext?.get('aiApiModel');

      // エージェント用のRuntimeContextを作成
      const runtimeContext =
        createRuntimeContext<TopicChecklistAgentRuntimeContext>({
          topic,
          checklistRequirements,
          employeeId,
          aiApiKey,
          aiApiUrl,
          aiApiModel,
        });

      // メッセージコンテンツを作成（ドキュメント + トピック情報）
      const messageContent = createCombinedMessage(
        files,
        `Please create checklist items from this document for topic: ${topic.title}`
      );

      // エージェントを実行（generateLegacyを使用）
      const result = await topicChecklistAgent.generateLegacy(
        {
          role: 'user',
          content: messageContent,
        },
        {
          output: topicChecklistOutputSchema,
          runtimeContext,
        }
      );

      // 構造化出力を取得
      const output = result.object;

      if (
        !output ||
        !output.checklistItems ||
        output.checklistItems.length === 0
      ) {
        return {
          status: 'failed',
          errorMessage: `トピック「${topic.title}」のチェックリスト項目を生成できませんでした`,
        };
      }

      return {
        status: 'success',
        checklistItems: output.checklistItems,
        topicTitle: topic.title,
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
