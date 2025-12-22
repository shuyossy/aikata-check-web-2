"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import {
  ClipboardList,
  Info,
  HelpCircle,
  Plus,
  Settings,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ReviewSettingsDto } from "@/domain/reviewSpace";
import { deleteReviewTargetAction } from "../review/actions";
import { showError, showSuccess, getMessage } from "@/lib/client";
import { extractServerErrorMessage } from "@/hooks";

/**
 * レビュー対象の型
 */
interface ReviewTargetItem {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
}

interface ReviewTargetListClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  spaceDescription: string | null;
  checkListItemCount: number;
  defaultReviewSettings: ReviewSettingsDto | null;
  /** レビュー対象一覧 */
  reviewTargets: ReviewTargetItem[];
}

/**
 * レビュー対象一覧クライアントコンポーネント
 */
/**
 * ステータスに応じたバッジ設定を取得
 */
function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "pending":
      return {
        icon: Clock,
        bgColor: "bg-gray-100",
        textColor: "text-gray-800",
        label: "準備中",
      };
    case "reviewing":
      return {
        icon: Loader2,
        bgColor: "bg-blue-100",
        textColor: "text-blue-800",
        label: "レビュー中",
        animate: true,
      };
    case "completed":
      return {
        icon: CheckCircle,
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        label: "完了",
      };
    case "error":
      return {
        icon: AlertCircle,
        bgColor: "bg-red-100",
        textColor: "text-red-800",
        label: "エラー",
      };
    default:
      return {
        icon: Clock,
        bgColor: "bg-gray-100",
        textColor: "text-gray-800",
        label: status,
      };
  }
}

export function ReviewTargetListClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  spaceDescription,
  checkListItemCount,
  defaultReviewSettings,
  reviewTargets,
}: ReviewTargetListClientProps) {
  const router = useRouter();
  const [isReviewSettingsOpen, setIsReviewSettingsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 削除アクション
  const { execute: executeDelete, isExecuting: isDeleting } = useAction(
    deleteReviewTargetAction,
    {
      onSuccess: () => {
        showSuccess(getMessage("SUCCESS_REVIEW_TARGET_DELETED"));
        setDeletingId(null);
        router.refresh();
      },
      onError: ({ error: actionError }) => {
        const message = extractServerErrorMessage(
          actionError,
          "レビュー対象の削除に失敗しました",
        );
        showError(message);
        setDeletingId(null);
      },
    },
  );

  // 削除ハンドラー
  const handleDelete = useCallback(
    (targetId: string, targetName: string) => {
      if (
        !confirm(`「${targetName}」を削除しますか？この操作は取り消せません。`)
      ) {
        return;
      }
      setDeletingId(targetId);
      executeDelete({ reviewTargetId: targetId, projectId, spaceId });
    },
    [executeDelete, projectId, spaceId],
  );

  // 日付フォーマット
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // レビュー設定が設定されているかどうか
  const hasReviewSettings =
    defaultReviewSettings &&
    (defaultReviewSettings.additionalInstructions ||
      defaultReviewSettings.concurrentReviewItems !== null ||
      defaultReviewSettings.commentFormat ||
      (defaultReviewSettings.evaluationCriteria &&
        defaultReviewSettings.evaluationCriteria.length > 0));

  return (
    <div className="flex-1 flex flex-col">
      {/* Page Content */}
      <main className="flex-1 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: projectName, href: `/projects/${projectId}/spaces` },
            { label: spaceName },
          ]}
        />

        {/* Space Information & Settings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                スペース情報
              </h3>
              <Link
                href={`/projects/${projectId}/spaces/${spaceId}/settings`}
                className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                設定
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Space Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  スペース名
                </label>
                <p className="text-sm text-gray-900">{spaceName}</p>
              </div>

              {/* Checklist Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  チェックリスト
                </label>
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-gray-600" />
                  <p className="text-sm text-gray-900">
                    {checkListItemCount}項目
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <p className="text-sm text-gray-600">
                  {spaceDescription || "説明はありません"}
                </p>
              </div>
            </div>

            {/* Default Review Settings */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <Collapsible
                open={isReviewSettingsOpen}
                onOpenChange={setIsReviewSettingsOpen}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                  <span className="text-sm font-medium text-gray-700">
                    既定のレビュー設定
                  </span>
                  {isReviewSettingsOpen ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                  {!hasReviewSettings && (
                    <span className="text-xs text-gray-400 ml-2">未設定</span>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {hasReviewSettings ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Additional Instructions */}
                      {defaultReviewSettings.additionalInstructions && (
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            追加指示
                          </label>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                            {defaultReviewSettings.additionalInstructions}
                          </p>
                        </div>
                      )}

                      {/* Concurrent Review Items */}
                      {defaultReviewSettings.concurrentReviewItems !== null && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            同時レビュー項目数
                          </label>
                          <p className="text-sm text-gray-700">
                            {defaultReviewSettings.concurrentReviewItems}項目
                          </p>
                        </div>
                      )}

                      {/* Comment Format */}
                      {defaultReviewSettings.commentFormat && (
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            コメントフォーマット
                          </label>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                            {defaultReviewSettings.commentFormat}
                          </p>
                        </div>
                      )}

                      {/* Evaluation Criteria */}
                      {defaultReviewSettings.evaluationCriteria &&
                        defaultReviewSettings.evaluationCriteria.length > 0 && (
                          <div className="lg:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-2">
                              評定基準
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {defaultReviewSettings.evaluationCriteria.map(
                                (item, index) => (
                                  <div
                                    key={index}
                                    className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg"
                                  >
                                    <span className="font-medium text-sm text-gray-900">
                                      {item.label}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {item.description}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
                      <p>既定のレビュー設定は設定されていません。</p>
                      <p className="mt-1">
                        <Link
                          href={`/projects/${projectId}/spaces/${spaceId}/settings`}
                          className="text-primary hover:text-primary/80"
                        >
                          設定ページ
                        </Link>
                        から追加できます。
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>

        {/* Page Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              レビュー対象一覧
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              このレビュースペースで管理するレビュー対象を確認・追加できます
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" asChild>
              <Link
                href={`/projects/${projectId}/spaces/${spaceId}/checklist`}
                className="flex items-center gap-2"
              >
                <ClipboardList className="w-5 h-5" />
                チェックリストを表示/編集
              </Link>
            </Button>
            <Button asChild className="flex items-center gap-2">
              <Link
                href={`/projects/${projectId}/spaces/${spaceId}/review/new`}
              >
                <PlayCircle className="w-5 h-5" />
                新規レビュー
              </Link>
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm text-blue-800 font-medium">
                レビュー対象について
              </p>
              <p className="mt-1 text-sm text-blue-700">
                各レビュー対象は、同一のチェックリストを使用してレビューされます。レビュー対象ごとに個別にレビューを実行し、結果を確認できます。
              </p>
            </div>
          </div>
        </div>

        {/* Review Targets Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16"
                  >
                    No.
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    レビュー対象名
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
                  >
                    ステータス
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40"
                  >
                    最終更新
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-56"
                  >
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reviewTargets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <p>レビュー対象がありません</p>
                        <p className="text-sm">
                          「新規レビュー」ボタンからレビューを開始してください
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reviewTargets.map((target, index) => {
                    const statusConfig = getStatusBadgeConfig(target.status);
                    const StatusIcon = statusConfig.icon;
                    const isThisDeleting = deletingId === target.id;
                    const canDelete = target.status !== "reviewing";

                    return (
                      <tr
                        key={target.id}
                        className="hover:bg-gray-50 transition duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <Link
                            href={`/projects/${projectId}/spaces/${spaceId}/review/${target.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {target.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
                          >
                            <StatusIcon
                              className={`w-3 h-3 mr-1 ${
                                statusConfig.animate ? "animate-spin" : ""
                              }`}
                            />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(target.updatedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="text-gray-600 hover:text-primary"
                            >
                              <Link
                                href={`/projects/${projectId}/spaces/${spaceId}/review/${target.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                結果を表示
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDelete(target.id, target.name)
                              }
                              disabled={!canDelete || isDeleting}
                              className="text-gray-600 hover:text-red-600"
                              title={
                                canDelete
                                  ? "削除"
                                  : "レビュー中は削除できません"
                              }
                            >
                              {isThisDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                レビュー対象管理のヒント
              </p>
              <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>すべてのレビュー対象は同一のチェックリストを使用します</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
