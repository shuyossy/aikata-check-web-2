import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { RuntimeContext } from "@mastra/core/di";
import type { BaseRuntimeContext } from "../types";

/**
 * AIモデルを取得する
 * 優先順位: プロジェクト設定 > 管理者設定（SystemSetting） > 環境変数
 *
 * @param runtimeContext - RuntimeContext（オプション）
 * @returns OpenAI互換のチャットモデル
 */
export const getModel = (runtimeContext?: RuntimeContext<BaseRuntimeContext>) => {
  // APIキー: プロジェクト設定 > 管理者設定 > 環境変数
  const projectApiKey = runtimeContext?.get("projectApiKey");
  const systemApiKey = runtimeContext?.get("systemApiKey");
  const apiKey = projectApiKey || systemApiKey || process.env.AI_API_KEY;

  // API URL: 管理者設定 > 環境変数（プロジェクトレベルでは設定不可）
  const systemApiUrl = runtimeContext?.get("systemApiUrl");
  const apiUrl = systemApiUrl || process.env.AI_API_URL;

  // APIモデル: 管理者設定 > 環境変数（プロジェクトレベルでは設定不可）
  const systemApiModel = runtimeContext?.get("systemApiModel");
  const apiModel = systemApiModel || process.env.AI_API_MODEL;

  if (!apiKey) {
    throw new Error('AI API Key is not configured');
  }

  if (!apiUrl) {
    throw new Error('AI_API_URL is not set');
  }

  if (!apiModel) {
    throw new Error('AI_API_MODEL is not set');
  }

  return createOpenAICompatible({
    name: 'openAICompatibleModel',
    apiKey,
    baseURL: apiUrl,
  }).chatModel(apiModel);
};
