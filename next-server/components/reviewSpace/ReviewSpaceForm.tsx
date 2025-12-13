"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { EvaluationCriteriaEditor } from "./EvaluationCriteriaEditor";
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

          <div className="space-y-4">
            {/* 追加指示 */}
            <div className="space-y-2">
              <Label htmlFor="additionalInstructions">追加指示</Label>
              <Textarea
                id="additionalInstructions"
                {...register("additionalInstructions")}
                placeholder="AIレビュー実行時に追加する指示を入力"
                rows={4}
                maxLength={2000}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                AIのレビュー実行時のシステムプロンプトに追加されます
              </p>
              {errors.additionalInstructions && (
                <p className="text-sm text-red-600">
                  {errors.additionalInstructions.message}
                </p>
              )}
            </div>

            {/* 同時レビュー項目数 */}
            <div className="space-y-2">
              <Label htmlFor="concurrentReviewItems">
                同時レビュー項目数 <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="concurrentReviewItems"
                control={control}
                render={({ field }) => (
                  <Input
                    id="concurrentReviewItems"
                    type="number"
                    min={1}
                    max={100}
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : 1,
                      )
                    }
                    placeholder="例: 5"
                    disabled={isSubmitting}
                  />
                )}
              />
              <p className="text-xs text-gray-500">
                AIが一度にレビューするチェック項目数（1〜100）
              </p>
              {errors.concurrentReviewItems && (
                <p className="text-sm text-red-600">
                  {errors.concurrentReviewItems.message}
                </p>
              )}
            </div>

            {/* コメントフォーマット */}
            <div className="space-y-2">
              <Label htmlFor="commentFormat">
                コメントフォーマット <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="commentFormat"
                {...register("commentFormat")}
                placeholder="例: 【評価理由】\n【改善提案】"
                rows={4}
                maxLength={2000}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                レビュー結果のコメントで使用するフォーマット
              </p>
              {errors.commentFormat && (
                <p className="text-sm text-red-600">
                  {errors.commentFormat.message}
                </p>
              )}
            </div>

            {/* 評定基準 */}
            <div className="space-y-2">
              <Label>
                評定基準 <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="evaluationCriteria"
                control={control}
                render={({ field }) => (
                  <EvaluationCriteriaEditor
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.evaluationCriteria && (
                <p className="text-sm text-red-600">
                  {errors.evaluationCriteria.message}
                </p>
              )}
            </div>
          </div>
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
