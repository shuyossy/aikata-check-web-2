"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ReviewSpaceForm, ReviewSpaceFormData } from "@/components/reviewSpace";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { createReviewSpaceAction } from "../../actions";
import { useAction } from "next-safe-action/hooks";
import { useServerActionError } from "@/hooks";

interface NewReviewSpaceClientProps {
  projectId: string;
  projectName: string;
}

/**
 * レビュースペース新規作成クライアントコンポーネント
 */
export function NewReviewSpaceClient({
  projectId,
  projectName,
}: NewReviewSpaceClientProps) {
  const router = useRouter();
  const { error, handleError } = useServerActionError();

  const { execute, isPending } = useAction(createReviewSpaceAction, {
    onSuccess: ({ data }) => {
      if (data) {
        router.push(`/projects/${projectId}/spaces`);
        router.refresh();
      }
    },
    onError: ({ error: actionError }) => {
      handleError(actionError, "レビュースペースの作成に失敗しました。");
    },
  });

  const handleSubmit = async (data: ReviewSpaceFormData) => {
    await execute({
      projectId,
      name: data.name,
      description: data.description || null,
    });
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}/spaces`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* パンくずリスト */}
      <Breadcrumb
        items={[
          { label: projectName, href: `/projects/${projectId}/spaces` },
          { label: "新規スペース" },
        ]}
      />

      {/* タイトル */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          新規レビュースペース
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          レビュースペースを作成して、レビューを開始しましょう
        </p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* フォーム */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <ReviewSpaceForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isPending}
          submitLabel="作成"
        />
      </div>
    </div>
  );
}
