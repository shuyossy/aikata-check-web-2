"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EvaluationCriteriaEditor } from "./EvaluationCriteriaEditor";

/**
 * 評価基準項目
 */
export interface EvaluationCriterionItem {
  label: string;
  description: string;
}

/**
 * レビュー設定の値
 */
export interface ReviewSettingsValue {
  additionalInstructions: string;
  concurrentReviewItems: number;
  commentFormat: string;
  evaluationCriteria: EvaluationCriterionItem[];
}

/**
 * ReviewSettingsEditorのProps
 */
export interface ReviewSettingsEditorProps {
  value: ReviewSettingsValue;
  onChange: (value: ReviewSettingsValue) => void;
  disabled?: boolean;
}

/**
 * レビュー設定エディタコンポーネント
 * 追加指示、同時レビュー項目数、コメントフォーマット、評価基準を編集できる
 */
export function ReviewSettingsEditor({
  value,
  onChange,
  disabled = false,
}: ReviewSettingsEditorProps) {
  // フィールド更新のヘルパー関数
  const updateField = <K extends keyof ReviewSettingsValue>(
    field: K,
    fieldValue: ReviewSettingsValue[K],
  ) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-6">
      {/* 追加指示 */}
      <div className="space-y-2">
        <Label htmlFor="additionalInstructions">追加指示</Label>
        <Textarea
          id="additionalInstructions"
          value={value.additionalInstructions}
          onChange={(e) =>
            updateField("additionalInstructions", e.target.value)
          }
          placeholder="AIレビュー実行時に追加する指示を入力"
          rows={4}
          maxLength={2000}
          disabled={disabled}
        />
        <p className="text-xs text-gray-500">
          AIのレビュー実行時のシステムプロンプトに追加されます
        </p>
      </div>

      {/* 同時レビュー項目数 */}
      <div className="space-y-2">
        <Label htmlFor="concurrentReviewItems">
          同時レビュー項目数 <span className="text-red-500">*</span>
        </Label>
        <Input
          id="concurrentReviewItems"
          type="number"
          min={1}
          max={100}
          value={value.concurrentReviewItems}
          onChange={(e) =>
            updateField(
              "concurrentReviewItems",
              e.target.value ? Number(e.target.value) : 1,
            )
          }
          placeholder="例: 5"
          disabled={disabled}
          className="w-32"
        />
        <p className="text-xs text-gray-500">
          AIが一度にレビューするチェック項目数（1〜100）
        </p>
      </div>

      {/* コメントフォーマット */}
      <div className="space-y-2">
        <Label htmlFor="commentFormat">
          コメントフォーマット <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="commentFormat"
          value={value.commentFormat}
          onChange={(e) => updateField("commentFormat", e.target.value)}
          placeholder="例: 【評価理由】\n【改善提案】"
          rows={4}
          maxLength={2000}
          disabled={disabled}
        />
        <p className="text-xs text-gray-500">
          レビュー結果のコメントで使用するフォーマット
        </p>
      </div>

      {/* 評定基準 */}
      <div className="space-y-2">
        <Label>
          評定基準 <span className="text-red-500">*</span>
        </Label>
        <EvaluationCriteriaEditor
          value={value.evaluationCriteria}
          onChange={(criteria) => updateField("evaluationCriteria", criteria)}
        />
      </div>
    </div>
  );
}
