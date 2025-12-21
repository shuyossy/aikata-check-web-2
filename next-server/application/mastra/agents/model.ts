import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { RuntimeContext } from "@mastra/core/di";
import type { BaseRuntimeContext } from "../types";
import { aiConfigError } from "@/lib/server/error";

/**
 * AIモデルを取得する
 * RuntimeContextから確定済みのAI API設定を取得
 * 設定がない場合は環境変数にフォールバック
 *
 * @param runtimeContext - RuntimeContext（オプション）
 * @returns OpenAI互換のチャットモデル
 */
export const getModel = (runtimeContext?: RuntimeContext<BaseRuntimeContext>) => {
  // RuntimeContextから確定済みのAPI設定を取得（環境変数フォールバック）
  const apiKey = runtimeContext?.get("aiApiKey") || process.env.AI_API_KEY;
  const apiUrl = runtimeContext?.get("aiApiUrl") || process.env.AI_API_URL;
  const apiModel = runtimeContext?.get("aiApiModel") || process.env.AI_API_MODEL;

  if (!apiKey) {
    throw aiConfigError("AI_CONFIG_API_KEY_MISSING");
  }

  if (!apiUrl) {
    throw aiConfigError("AI_CONFIG_API_URL_MISSING");
  }

  if (!apiModel) {
    throw aiConfigError("AI_CONFIG_API_MODEL_MISSING");
  }

  return createOpenAICompatible({
    name: 'openAICompatibleModel',
    apiKey,
    baseURL: apiUrl,
  }).chatModel(apiModel);
};
