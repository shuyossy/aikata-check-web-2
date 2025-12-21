"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { GetSystemSettingResultDto } from "@/application/system-setting";
import { SystemSettingsForm } from "./SystemSettingsForm";
import { updateSystemSettingAction } from "../actions";
import { useServerActionError } from "@/hooks";
import { showSuccess, getMessage } from "@/lib/client";

interface SettingsClientProps {
  initialSettings: GetSystemSettingResultDto | null;
}

/**
 * API設定管理クライアントコンポーネント
 */
export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [settings, setSettings] = useState<GetSystemSettingResultDto | null>(
    initialSettings
  );
  const { error, handleError, clearError } = useServerActionError();

  // 設定更新
  const { execute: updateSettings, isPending: isUpdating } = useAction(
    updateSystemSettingAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setSettings(data);
          showSuccess(getMessage("SUCCESS_SETTINGS_SAVED"));
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "設定の保存に失敗しました");
      },
    }
  );

  const handleSubmit = (data: {
    apiKey?: string;
    apiUrl?: string;
    apiModel?: string;
  }) => {
    updateSettings(data);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">API設定</h1>
        <p className="text-gray-600">
          システム全体で使用するAI APIの設定を管理します
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 設定フォームカード */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            AI API設定
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            ここで設定されたAPIキー・URL・モデルがシステム全体で優先的に使用されます
          </p>
        </div>

        <div className="p-6">
          <SystemSettingsForm
            initialData={settings}
            onSubmit={handleSubmit}
            isSubmitting={isUpdating}
          />
        </div>
      </div>

      {/* 注意事項 */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">
          注意事項
        </h3>
        <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
          <li>APIキーは暗号化して保存されます</li>
          <li>設定を変更すると、すべてのユーザーに即座に反映されます</li>
          <li>
            システム設定が空の場合は、環境変数の設定が使用されます
          </li>
        </ul>
      </div>
    </div>
  );
}
