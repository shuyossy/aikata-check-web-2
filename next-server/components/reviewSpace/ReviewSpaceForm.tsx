"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ReviewSettingsEditor, ReviewSettingsValue } from "./ReviewSettingsEditor";
import {
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_CONCURRENT_REVIEW_ITEMS,
  DEFAULT_COMMENT_FORMAT,
} from "@/domain/reviewSpace";

// 評定項目のスキーマ
const evaluationItemSchema = z.object({
  label: z.string().min(1, "ラベルは必須です").max(10),
  description: z.string().min(1, "定義は必須です").max(200),
});

// バリデーションスキーマ
const reviewSpaceFormSchema = z.object({
  name: z
    .string()
    .min(1, "スペース名は必須です")
    .max(100, "スペース名は100文字以内で入力してください"),
  description: z
    .string()
    .max(1000, "説明は1000文字以内で入力してください")
    .nullable()
    .optional(),
  // レビュー設定
  additionalInstructions: z
    .string()
    .max(2000, "追加指示は2000文字以内で入力してください")
    .nullable()
    .optional(),
  concurrentReviewItems: z
    .number()
    .min(1, "1以上の値を入力してください")
    .max(100, "100以下の値を入力してください"),
  commentFormat: z
    .string()
    .min(1, "コメントフォーマットは必須です")
    .max(2000, "コメントフォーマットは2000文字以内で入力してください"),
  evaluationCriteria: z
    .array(evaluationItemSchema)
    .min(1, "評定基準は1つ以上必要です")
    .max(10, "評定基準は10項目以内で設定してください"),
});

export type ReviewSpaceFormData = z.infer<typeof reviewSpaceFormSchema>;

interface ReviewSpaceFormProps {
  defaultValues?: Partial<ReviewSpaceFormData>;
  onSubmit: (data: ReviewSpaceFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

/**
 * レビュースペースフォームコンポーネント
 * 新規作成・編集に使用
 */
export function ReviewSpaceForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "作成",
}: ReviewSpaceFormProps) {
  const [isReviewSettingsOpen, setIsReviewSettingsOpen] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReviewSpaceFormData>({
    resolver: zodResolver(reviewSpaceFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      additionalInstructions: defaultValues?.additionalInstructions ?? "",
      concurrentReviewItems:
        defaultValues?.concurrentReviewItems ?? DEFAULT_CONCURRENT_REVIEW_ITEMS,
      commentFormat: defaultValues?.commentFormat ?? DEFAULT_COMMENT_FORMAT,
      evaluationCriteria:
        defaultValues?.evaluationCriteria ?? [...DEFAULT_EVALUATION_CRITERIA],
    },
  });

  // レビュー設定の値をwatchで監視
  const reviewSettingsValue: ReviewSettingsValue = {
    additionalInstructions: watch("additionalInstructions") ?? "",
    concurrentReviewItems: watch("concurrentReviewItems"),
    commentFormat: watch("commentFormat"),
    evaluationCriteria: watch("evaluationCriteria"),
  };

  // レビュー設定の変更ハンドラー
  const handleReviewSettingsChange = useCallback(
    (value: ReviewSettingsValue) => {
      setValue("additionalInstructions", value.additionalInstructions);
      setValue("concurrentReviewItems", value.concurrentReviewItems);
      setValue("commentFormat", value.commentFormat);
      setValue("evaluationCriteria", value.evaluationCriteria);
    },
    [setValue]
  );

  // バリデーションエラーメッセージの収集
  const reviewSettingsErrors = [
    errors.additionalInstructions?.message,
    errors.concurrentReviewItems?.message,
    errors.commentFormat?.message,
    errors.evaluationCriteria?.message,
  ].filter(Boolean);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 基本情報 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          基本情報
        </h3>

        {/* スペース名 */}
        <div className="space-y-2">
          <Label htmlFor="name">
            スペース名 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="設計書レビュー"
            disabled={isSubmitting}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
          />
          {errors.name && (
            <p className="text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* 説明 */}
        <div className="space-y-2">
          <Label htmlFor="description">説明</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="このスペースの説明を入力してください"
            rows={3}
            disabled={isSubmitting}
          />
          {errors.description && (
            <p className="text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>
      </div>

      {/* 既定のレビュー設定 */}
      <Collapsible
        open={isReviewSettingsOpen}
        onOpenChange={setIsReviewSettingsOpen}
      >
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
          <h3 className="text-lg font-semibold text-gray-900">
            既定のレビュー設定
          </h3>
          {isReviewSettingsOpen ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-6 border-t pt-4">
          <p className="text-sm text-gray-600">
            レビュー対象を作成する際のデフォルト設定を指定できます
          </p>

          <ReviewSettingsEditor
            value={reviewSettingsValue}
            onChange={handleReviewSettingsChange}
            disabled={isSubmitting}
          />

          {/* バリデーションエラーの表示 */}
          {reviewSettingsErrors.length > 0 && (
            <div className="space-y-1">
              {reviewSettingsErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-600">
                  {error}
                </p>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ボタン */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              処理中...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
