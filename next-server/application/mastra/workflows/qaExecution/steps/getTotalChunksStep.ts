import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { baseStepOutputSchema } from '../../schema';
import { normalizeUnknownError } from '@/lib/server/error';
import { getLogger } from '@/lib/server/logger';
import { LargeDocumentResultCacheRepository } from '@/infrastructure/adapter/db/drizzle/repository/LargeDocumentResultCacheRepository';

const logger = getLogger();

/**
 * 最大チャンク数取得ステップの入力スキーマ
 */
export const getTotalChunksStepInputSchema = z.object({
  /** ドキュメントキャッシュID */
  documentCacheId: z.string(),
  /** 調査内容 */
  researchContent: z.string(),
  /** 調査理由 */
  reasoning: z.string(),
});

export type GetTotalChunksStepInput = z.infer<typeof getTotalChunksStepInputSchema>;

/**
 * 最大チャンク数取得ステップの出力スキーマ
 */
export const getTotalChunksStepOutputSchema = baseStepOutputSchema.extend({
  /** ドキュメントキャッシュID */
  documentCacheId: z.string().optional(),
  /** 調査内容 */
  researchContent: z.string().optional(),
  /** 調査理由 */
  reasoning: z.string().optional(),
  /** 最大チャンク数 */
  totalChunks: z.number().optional(),
});

export type GetTotalChunksStepOutput = z.infer<typeof getTotalChunksStepOutputSchema>;

/**
 * 最大チャンク数取得ステップ
 * 過去のレビュー履歴から、ドキュメントの最大チャンク数を取得する
 */
export const getTotalChunksStep = createStep({
  id: 'getTotalChunksStep',
  description: '最大チャンク数を取得するステップ',
  inputSchema: getTotalChunksStepInputSchema,
  outputSchema: getTotalChunksStepOutputSchema,
  execute: async ({ inputData, bail }) => {
    try {
      const { documentCacheId, researchContent, reasoning } = inputData;

      // リポジトリから最大チャンク数を取得
      const repository = new LargeDocumentResultCacheRepository();
      const totalChunks = await repository.getMaxTotalChunksForDocument(documentCacheId);

      return {
        status: 'success' as const,
        documentCacheId,
        researchContent,
        reasoning,
        totalChunks,
      };
    } catch (error) {
      logger.error({ err: error }, '最大チャンク数の取得に失敗しました');
      const normalizedError = normalizeUnknownError(error);
      return bail({
        status: 'failed' as const,
        errorMessage: normalizedError.message,
      });
    }
  },
});
