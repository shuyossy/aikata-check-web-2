import { EncryptedApiKey } from "@/domain/project/EncryptedApiKey";
import { SystemSetting } from "@/domain/system-setting/SystemSetting";
import { aiConfigError } from "@/lib/server/error";

/**
 * AI API設定
 * キューイング時点で確定した最終的なAPI設定を保持
 */
export interface AiApiConfig {
  /** 確定済みAPIキー */
  apiKey: string;
  /** 確定済みAPI URL */
  apiUrl: string;
  /** 確定済みAPIモデル名 */
  apiModel: string;
}

/**
 * AI API設定を解決する
 * 優先順位: プロジェクト設定 > 管理者設定 > 環境変数
 *
 * @param projectEncryptedApiKey プロジェクトレベルの暗号化APIキー（オプション）
 * @param systemSetting システム設定（管理者設定）（オプション）
 * @returns 確定済みのAI API設定
 * @throws aiConfigError APIキー、URL、モデルのいずれかが欠落している場合
 */
export function resolveAiApiConfig(
  projectEncryptedApiKey?: EncryptedApiKey | null,
  systemSetting?: SystemSetting | null,
): AiApiConfig {
  const systemDto = systemSetting?.toDto();

  // APIキー: プロジェクト設定 > システム設定 > 環境変数
  const projectApiKey = projectEncryptedApiKey?.decrypt() ?? null;
  const apiKey = projectApiKey ?? systemDto?.apiKey ?? process.env.AI_API_KEY;

  // API URL: システム設定 > 環境変数（プロジェクトレベルでは設定不可）
  const apiUrl = systemDto?.apiUrl ?? process.env.AI_API_URL;

  // APIモデル: システム設定 > 環境変数（プロジェクトレベルでは設定不可）
  const apiModel = systemDto?.apiModel ?? process.env.AI_API_MODEL;

  // 必須値の検証
  if (!apiKey) {
    throw aiConfigError("AI_CONFIG_API_KEY_MISSING");
  }

  if (!apiUrl) {
    throw aiConfigError("AI_CONFIG_API_URL_MISSING");
  }

  if (!apiModel) {
    throw aiConfigError("AI_CONFIG_API_MODEL_MISSING");
  }

  return {
    apiKey,
    apiUrl,
    apiModel,
  };
}
