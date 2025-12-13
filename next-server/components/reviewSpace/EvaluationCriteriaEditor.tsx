"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_EVALUATION_CRITERIA } from "@/domain/reviewSpace";

interface EvaluationItem {
  label: string;
  description: string;
}

interface EvaluationCriteriaEditorProps {
  value: EvaluationItem[];
  onChange: (value: EvaluationItem[]) => void;
}

/**
 * 評定基準エディタコンポーネント
 * 評定項目（ラベルと説明）を動的に追加・編集・削除できるフォーム
 */
export function EvaluationCriteriaEditor({
  value,
  onChange,
}: EvaluationCriteriaEditorProps) {
  const handleAddItem = () => {
    onChange([...value, { label: "", description: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = value.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleItemChange = (
    index: number,
    field: keyof EvaluationItem,
    newValue: string,
  ) => {
    const newItems = value.map((item, i) =>
      i === index ? { ...item, [field]: newValue } : item,
    );
    onChange(newItems);
  };

  const handleResetToDefault = () => {
    onChange([...DEFAULT_EVALUATION_CRITERIA]);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        AIがレビュー結果に付与する評定のラベルと定義を設定します
      </p>

      {value.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500 mb-3">評定基準が設定されていません</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
            >
              デフォルト設定を使用
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
              <Plus className="h-4 w-4 mr-1" />
              カスタム項目を追加
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {value.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-shrink-0 w-20">
                  <Input
                    value={item.label}
                    onChange={(e) =>
                      handleItemChange(index, "label", e.target.value)
                    }
                    placeholder="ラベル"
                    maxLength={10}
                    className="text-center font-medium"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(index, "description", e.target.value)
                    }
                    placeholder="定義（例: 基準を完全に満たしている）"
                    maxLength={200}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveItem(index)}
                  className="text-gray-400 hover:text-red-500"
                  disabled={value.length <= 1}
                  title="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={value.length >= 10}
            >
              <Plus className="h-4 w-4 mr-1" />
              項目を追加
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="text-gray-500"
            >
              デフォルトにリセット
            </Button>
          </div>

          {value.length >= 10 && (
            <p className="text-xs text-amber-600">
              評定基準は最大10項目まで設定できます
            </p>
          )}
        </>
      )}
    </div>
  );
}
