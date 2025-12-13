import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { RuntimeContext } from "@mastra/core/di";
import type { BaseRuntimeContext } from "../types";

/**
 * AIモデルを取得する
 * RuntimeContextからprojectApiKeyが取得できればそれを使用し、
 * なければ環境変数のAI_API_KEYをフォールバックとして使用
 *
 * @param runtimeContext - RuntimeContext（オプション）
 * @returns OpenAI互換のチャットモデル
 */
export const getModel = (runtimeContext?: RuntimeContext<BaseRuntimeContext>) => {
  // プロジェクトのAPIキーを優先、なければ環境変数をフォールバック
  const projectApiKey = runtimeContext?.get("projectApiKey");
  const apiKey = projectApiKey || process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('AI API Key is not configured');
  }

  if (!process.env.AI_API_URL) {
    throw new Error('AI_API_URL is not set');
  }

  if (!process.env.AI_API_MODEL) {
    throw new Error('AI_API_MODEL is not set');
  }

  return createOpenAICompatible({
    name: 'openAICompatibleModel',
    apiKey,
    baseURL: process.env.AI_API_URL,
  }).chatModel(process.env.AI_API_MODEL);
};
