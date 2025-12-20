"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { GetSystemSettingResultDto } from "@/application/system-setting";

interface SystemSettingsFormProps {
  initialData: GetSystemSettingResultDto | null;
  onSubmit: (data: {
    apiKey?: string;
    apiUrl?: string;
    apiModel?: string;
  }) => void;
  isSubmitting: boolean;
}

/**
 * システム設定フォームコンポーネント
 */
export function SystemSettingsForm({
  initialData,
  onSubmit,
  isSubmitting,
}: SystemSettingsFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiModel, setApiModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isApiKeyChanged, setIsApiKeyChanged] = useState(false);

  // 初期データをセット
  useEffect(() => {
    if (initialData) {
      setApiUrl(initialData.apiUrl || "");
      setApiModel(initialData.apiModel || "");
      // APIキーは表示しない（hasApiKeyで設定有無のみ確認）
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: { apiKey?: string; apiUrl?: string; apiModel?: string } = {};

    // APIキーは変更された場合のみ送信
    if (isApiKeyChanged && apiKey) {
      data.apiKey = apiKey;
    }

    if (apiUrl) {
      data.apiUrl = apiUrl;
    }

    if (apiModel) {
      data.apiModel = apiModel;
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* APIキー */}
      <div className="space-y-2">
        <Label htmlFor="apiKey">
          APIキー
          {initialData?.hasApiKey && !isApiKeyChanged && (
            <span className="ml-2 text-xs text-green-600">（設定済み）</span>
          )}
        </Label>
        <div className="relative">
          <Input
            id="apiKey"
            type={showApiKey ? "text" : "password"}
            placeholder={
              initialData?.hasApiKey
                ? "新しいAPIキーを入力すると上書きされます"
                : "APIキーを入力..."
            }
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setIsApiKeyChanged(true);
            }}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showApiKey ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          AI APIへのアクセスに使用するキー
        </p>
      </div>

      {/* API URL */}
      <div className="space-y-2">
        <Label htmlFor="apiUrl">API URL</Label>
        <Input
          id="apiUrl"
          type="url"
          placeholder="https://api.example.com/v1"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          AI APIのベースURL
        </p>
      </div>

      {/* モデル名 */}
      <div className="space-y-2">
        <Label htmlFor="apiModel">モデル名</Label>
        <Input
          id="apiModel"
          type="text"
          placeholder="gpt-4o-mini"
          value={apiModel}
          onChange={(e) => setApiModel(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          使用するAIモデルの名前
        </p>
      </div>

      {/* 送信ボタン */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            "設定を保存"
          )}
        </Button>
      </div>
    </form>
  );
}
