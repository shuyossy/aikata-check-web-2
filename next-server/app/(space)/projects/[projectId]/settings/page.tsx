"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ProjectForm, ProjectFormData } from "@/components/project";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  getProjectAction,
  updateProjectAction,
  updateProjectMembersAction,
  deleteProjectAction,
} from "@/app/(project)/projects/actions";
import { useAction } from "next-safe-action/hooks";
import { ProjectDto } from "@/domain/project";
import { UserDto } from "@/domain/user";
import { useServerActionError } from "@/hooks";

interface Props {
  params: Promise<{ projectId: string }>;
}

/**
 * プロジェクト設定ページ
 */
export default function ProjectSettingsPage({ params }: Props) {
  const { projectId } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { error, clearError, handleError } = useServerActionError();

  const { execute: loadProject } = useAction(getProjectAction, {
    onSuccess: ({ data }) => {
      if (data) {
        setProject(data);
        clearError();
      }
      setIsLoading(false);
    },
    onError: ({ error: actionError }) => {
      setIsLoading(false);
      handleError(actionError, "プロジェクト情報の取得に失敗しました。");
    },
  });

  const { execute: updateProject, isPending: isUpdating } = useAction(
    updateProjectAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setProject(data);
          clearError();
          router.push(`/projects/${projectId}/spaces`);
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "プロジェクトの更新に失敗しました。");
      },
    },
  );

  const { execute: updateMembers } = useAction(updateProjectMembersAction, {
    onSuccess: ({ data }) => {
      if (data) {
        setProject(data);
        clearError();
      }
    },
    onError: ({ error: actionError }) => {
      handleError(actionError, "メンバーの更新に失敗しました。");
    },
  });

  const { execute: deleteProject, isPending: isDeleting } = useAction(
    deleteProjectAction,
    {
      onSuccess: () => {
        router.push("/projects");
      },
      onError: ({ error: actionError }) => {
        setShowDeleteConfirm(false);
        handleError(actionError, "プロジェクトの削除に失敗しました。");
      },
    },
  );

  // 初期ロード
  useEffect(() => {
    loadProject({ projectId });
  }, [projectId, loadProject]);

  // 現在のユーザー情報（セッションから取得）
  const currentUser: UserDto | null = session?.user
    ? {
        id: session.user.id ?? "",
        employeeId: session.user.employeeId ?? "",
        displayName: session.user.displayName ?? "",
      }
    : null;

  const handleSubmit = async (data: ProjectFormData) => {
    // プロジェクト情報を更新
    await updateProject({
      projectId,
      name: data.name,
      description: data.description || null,
      apiKey: data.apiKey || null,
    });

    // メンバーを更新（変更があれば）
    const newMemberIds = data.members.map((m) => m.id).sort();
    const currentMemberIds = project?.members.map((m) => m.userId).sort() ?? [];
    if (JSON.stringify(newMemberIds) !== JSON.stringify(currentMemberIds)) {
      await updateMembers({
        projectId,
        memberIds: newMemberIds,
      });
    }
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}/spaces`);
  };

  const handleDelete = () => {
    deleteProject({ projectId });
  };

  if (isLoading || !currentUser) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-16">
            <svg
              className="animate-spin h-8 w-8 text-blue-500 mr-3"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-600">読み込み中...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              プロジェクトが見つかりません
            </h3>
            <p className="mt-2 text-gray-600">
              指定されたプロジェクトは存在しないか、アクセス権がありません
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-150 font-medium"
            >
              プロジェクト一覧に戻る
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // プロジェクトデータをフォーム用に変換
  const formData: Partial<ProjectFormData> = {
    name: project.name,
    description: project.description ?? "",
    apiKey: "", // APIキーは表示しない（セキュリティ上）
    members: project.members.map((m) => ({
      id: m.userId,
      employeeId: m.employeeId,
      displayName: m.displayName,
    })),
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: project.name, href: `/projects/${projectId}/spaces` },
            { label: "設定" },
          ]}
        />

        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            プロジェクト設定
          </h2>
          <p className="text-gray-600">プロジェクトの設定を編集できます</p>
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
              initialData={formData}
              currentUser={currentUser}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isUpdating}
              submitLabel="変更を保存"
            />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 bg-white rounded-lg border border-red-200 shadow-sm">
          <div className="p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-red-600 mb-4">
              危険な操作
            </h3>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">
                  プロジェクトを削除する
                </p>
                <p className="text-sm text-gray-600">
                  この操作は取り消せません。すべてのレビュースペースとデータが削除されます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-150 font-medium"
              >
                削除
              </button>
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
                  プロジェクトを削除しますか？
                </h3>
                <p className="text-sm text-gray-600">
                  「{project.name}」を削除します。この操作は取り消せません。
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-150 font-medium text-center disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-150 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    削除中...
                  </>
                ) : (
                  "削除する"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
