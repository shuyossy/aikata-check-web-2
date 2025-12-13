"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import {
  updateReviewSpaceAction,
  deleteReviewSpaceAction,
} from "@/app/(space)/projects/[projectId]/spaces/actions";
import {
  ReviewSpaceDto,
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_CONCURRENT_REVIEW_ITEMS,
  DEFAULT_COMMENT_FORMAT,
} from "@/domain/reviewSpace";
import { ReviewSpaceForm, ReviewSpaceFormData } from "@/components/reviewSpace";
import { useServerActionError } from "@/hooks";
import { showSuccess } from "@/lib/client/toast";
import { Loader2 } from "lucide-react";

interface Props {
  projectId: string;
  spaceId: string;
  initialReviewSpace: ReviewSpaceDto;
}

/**
 * レビュースペース設定クライアントコンポーネント
 * 更新・削除操作を担当
 */
export function ReviewSpaceSettingsClient({
  projectId,
  spaceId,
  initialReviewSpace,
}: Props) {
  const router = useRouter();
  const [reviewSpace, setReviewSpace] =
    useState<ReviewSpaceDto>(initialReviewSpace);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { error, clearError, handleError } = useServerActionError();

  const { execute: updateReviewSpace, isPending: isUpdating } = useAction(
    updateReviewSpaceAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setReviewSpace(data);
          clearError();
          showSuccess("レビュースペースを更新しました");
          router.push(`/projects/${projectId}/spaces/${spaceId}`);
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "レビュースペースの更新に失敗しました。");
      },
    },
  );

  const { execute: deleteReviewSpace, isPending: isDeleting } = useAction(
    deleteReviewSpaceAction,
    {
      onSuccess: () => {
        showSuccess("レビュースペースを削除しました");
        router.push(`/projects/${projectId}/spaces`);
      },
      onError: ({ error: actionError }) => {
        setShowDeleteConfirm(false);
        handleError(actionError, "レビュースペースの削除に失敗しました。");
      },
    },
  );

  const handleSubmit = async (data: ReviewSpaceFormData) => {
    await updateReviewSpace({
      reviewSpaceId: spaceId,
      name: data.name,
      description: data.description || null,
      defaultReviewSettings: {
        additionalInstructions: data.additionalInstructions || null,
        concurrentReviewItems: data.concurrentReviewItems,
        commentFormat: data.commentFormat,
        evaluationCriteria: data.evaluationCriteria,
      },
    });
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}/spaces/${spaceId}`);
  };

  const handleDelete = () => {
    deleteReviewSpace({ reviewSpaceId: spaceId });
  };

  // フォームの初期値を設定
  const defaultValues: Partial<ReviewSpaceFormData> = {
    name: reviewSpace.name,
    description: reviewSpace.description,
    additionalInstructions:
      reviewSpace.defaultReviewSettings?.additionalInstructions ?? "",
    concurrentReviewItems:
      reviewSpace.defaultReviewSettings?.concurrentReviewItems ??
      DEFAULT_CONCURRENT_REVIEW_ITEMS,
    commentFormat:
      reviewSpace.defaultReviewSettings?.commentFormat ?? DEFAULT_COMMENT_FORMAT,
    evaluationCriteria:
      reviewSpace.defaultReviewSettings?.evaluationCriteria ?? [
        ...DEFAULT_EVALUATION_CRITERIA,
      ],
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            {
              label: reviewSpace.name,
              href: `/projects/${projectId}/spaces/${spaceId}`,
            },
            { label: "設定" },
          ]}
        />

        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            レビュースペース設定
          </h2>
          <p className="text-gray-600">レビュースペースの設定を編集できます</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6 p-6 sm:p-8">
          <ReviewSpaceForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isUpdating}
            submitLabel="変更を保存"
          />
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg border border-red-200 shadow-sm">
          <div className="p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-red-600 mb-4">
              危険な操作
            </h3>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">
                  レビュースペースを削除する
                </p>
                <p className="text-sm text-gray-600">
                  この操作は取り消せません。すべてのチェックリストとレビュー対象データが削除されます。
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                削除
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  レビュースペースを削除しますか？
                </h3>
                <p className="text-sm text-gray-600">
                  「{reviewSpace.name}」を削除します。この操作は取り消せません。
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    削除中...
                  </>
                ) : (
                  "削除する"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
