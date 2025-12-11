"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewSpaceFormData>({
    resolver: zodResolver(reviewSpaceFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* スペース名 */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          スペース名 <span className="text-red-500">*</span>
        </label>
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
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* 説明 */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          説明
        </label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="このスペースの説明を入力してください"
          rows={4}
          disabled={isSubmitting}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">
            {errors.description.message}
          </p>
        )}
      </div>

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
