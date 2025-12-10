"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ProjectForm, ProjectFormData } from "@/components/project";
import { createProjectAction } from "../actions";
import { useAction } from "next-safe-action/hooks";
import { UserDto } from "@/domain/user";
import { useServerActionError } from "@/hooks";

/**
 * 新規プロジェクト作成ページ
 */
export default function NewProjectPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { error, clearError, handleError } = useServerActionError();

  const { execute: createProject, isPending: isSubmitting } = useAction(
    createProjectAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          clearError();
          router.push(`/projects/${data.id}/review-spaces`);
        }
      },
      onError: ({ error: actionError }) => {
        console.error("プロジェクト作成エラー:", actionError);
        handleError(
          actionError,
          "プロジェクトの作成に失敗しました。もう一度お試しください。",
        );
      },
    },
  );

  // 現在のユーザー情報（セッションから取得）
  const currentUser: UserDto | null = session?.user
    ? {
        id: session.user.id ?? "",
        employeeId: session.user.employeeId ?? "",
        displayName: session.user.displayName ?? "",
      }
    : null;

  const handleSubmit = (data: ProjectFormData) => {
    createProject({
      name: data.name,
      description: data.description || null,
      apiKey: data.apiKey || null,
      memberIds: data.members.map((m) => m.id),
    });
  };

  const handleCancel = () => {
    router.push("/projects");
  };

  if (!currentUser) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex text-sm text-gray-500 mb-6">
          <Link
            href="/projects"
            className="hover:text-gray-700 transition duration-150"
          >
            プロジェクト
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">新規作成</span>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            新規プロジェクト作成
          </h2>
          <p className="text-gray-600">プロジェクト情報を入力してください</p>
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 sm:p-8">
            <ProjectForm
              currentUser={currentUser}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
              submitLabel="プロジェクトを作成"
            />
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-gray-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                プロジェクト作成のヒント
              </p>
              <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>プロジェクト名は後から変更できます</li>
                <li>APIキーは作成後でも設定・変更が可能です</li>
                <li>メンバーはいつでも追加・削除できます</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
