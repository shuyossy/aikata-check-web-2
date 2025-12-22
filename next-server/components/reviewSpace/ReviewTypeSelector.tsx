"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from "lucide-react";

/**
 * レビュー種別
 */
export type ReviewTypeValue = "small" | "large" | "api";

interface ReviewTypeSelectorProps {
  /** 選択中の値 */
  value: ReviewTypeValue;
  /** 値変更ハンドラ */
  onChange: (value: ReviewTypeValue) => void;
  /** 無効化フラグ */
  disabled?: boolean;
  /** 前回のレビュー種別（リトライ時の表示用） */
  previousType?: ReviewTypeValue | null;
  /** API呼び出しオプションを表示するか（デフォルト: false） */
  showApiOption?: boolean;
}

/**
 * レビュー種別選択コンポーネント
 * 少量レビュー、大量レビュー、（オプション）API呼び出しを選択するラジオグループ
 */
export function ReviewTypeSelector({
  value,
  onChange,
  disabled = false,
  previousType = null,
  showApiOption = false,
}: ReviewTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ReviewTypeValue)}
        disabled={disabled}
        className="space-y-3"
      >
        {/* 少量レビュー */}
        <div className="flex items-start space-x-3 p-3 border rounded-lg bg-white hover:bg-gray-50">
          <RadioGroupItem value="small" id="review-small" className="mt-1" />
          <div className="flex-1">
            <Label
              htmlFor="review-small"
              className="font-medium cursor-pointer"
            >
              少量レビュー
              {previousType === "small" && (
                <span className="ml-2 text-xs text-gray-500">(前回の設定)</span>
              )}
            </Label>
            <p className="text-sm text-gray-500">
              コンテキストウィンドウに収まるドキュメントをそのまま処理します
            </p>
          </div>
        </div>

        {/* 大量レビュー */}
        <div className="flex items-start space-x-3 p-3 border rounded-lg bg-white hover:bg-gray-50">
          <RadioGroupItem value="large" id="review-large" className="mt-1" />
          <div className="flex-1">
            <Label
              htmlFor="review-large"
              className="font-medium cursor-pointer"
            >
              大量レビュー
              {previousType === "large" && (
                <span className="ml-2 text-xs text-gray-500">(前回の設定)</span>
              )}
            </Label>
            <p className="text-sm text-gray-500">
              大きなドキュメントを分割して処理し、結果を統合します
            </p>
          </div>
        </div>

        {/* API呼び出し（オプション） */}
        {showApiOption && (
          <div
            className={`flex items-start space-x-3 p-3 border rounded-lg bg-white hover:bg-gray-50 ${value === "api" ? "border-amber-300 bg-amber-50" : ""}`}
          >
            <RadioGroupItem value="api" id="review-api" className="mt-1" />
            <div className="flex-1">
              <Label
                htmlFor="review-api"
                className="font-medium cursor-pointer"
              >
                API呼び出し
                {previousType === "api" && (
                  <span className="ml-2 text-xs text-gray-500">
                    (前回の設定)
                  </span>
                )}
              </Label>
              <p className="text-sm text-gray-500">
                外部APIにレビュー処理を委託します
              </p>
            </div>
          </div>
        )}
      </RadioGroup>

      {/* API呼び出し選択時の警告メッセージ */}
      {showApiOption && value === "api" && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">
              API呼び出しを選択すると以下の機能が利用できなくなります：
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>リトライ機能</li>
              <li>Q&A機能</li>
            </ul>
            <p className="mt-2 text-amber-700">
              また、外部APIエンドポイントの設定が必要です。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
