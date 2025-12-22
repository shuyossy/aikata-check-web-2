"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { exportReviewResultsToCsvAction } from "../actions/exportReviewResultsToCsv";
import { showSuccess, showError, formatClientMessage } from "@/lib/client";
import { extractServerErrorMessage } from "@/hooks";
import {
  MessageCircle,
  RefreshCw,
  Download,
  Loader2,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { useReviewResultsPolling } from "../hooks/useReviewResultsPolling";
import type { EvaluationCriterion } from "@/application/mastra";

/**
 * レビュー結果データ
 */
interface ReviewResultData {
  id: string;
  /** チェック項目の内容（レビュー実行時点のスナップショット） */
  checkListItemContent: string;
  evaluation: string | null;
  comment: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

/**
 * レビュー設定データ
 */
interface ReviewSettingsData {
  additionalInstructions: string | null;
  concurrentReviewItems?: number;
  commentFormat: string | null;
  evaluationCriteria?: EvaluationCriterion[];
}

/**
 * レビュー対象データ
 */
interface ReviewTargetData {
  id: string;
  reviewSpaceId: string;
  name: string;
  status: string;
  reviewSettings: ReviewSettingsData | null;
  reviewResults: ReviewResultData[];
  createdAt: Date;
  updatedAt: Date;
}

interface ReviewResultsClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  targetId: string;
  /** レビュー対象データ */
  reviewTarget: ReviewTargetData;
  /** リトライ可能かどうか */
  canRetry: boolean;
}

/**
 * ステータスに応じたバナー設定を取得
 */
function getStatusBannerConfig(status: string) {
  switch (status) {
    case "pending":
      return {
        icon: Clock,
        bgColor: "bg-gray-50",
        borderColor: "border-gray-500",
        textColor: "text-gray-800",
        iconColor: "text-gray-500",
        title: "準備中",
        message: "レビュー実行を待機しています。",
      };
    case "queued":
      return {
        icon: Clock,
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-500",
        textColor: "text-yellow-800",
        iconColor: "text-yellow-500",
        title: "待機中",
        message:
          "AIレビュータスクが実行待ちリストに登録されました。順番が来るまでお待ちください。",
      };
    case "reviewing":
      return {
        icon: Loader2,
        bgColor: "bg-blue-50",
        borderColor: "border-blue-500",
        textColor: "text-blue-800",
        iconColor: "text-blue-500",
        title: "レビュー実行中",
        message:
          "AIがドキュメントをレビューしています。しばらくお待ちください。",
        animate: true,
      };
    case "completed":
      return {
        icon: CheckCircle,
        bgColor: "bg-green-50",
        borderColor: "border-green-500",
        textColor: "text-green-800",
        iconColor: "text-green-500",
        title: "レビュー完了",
        message: null,
      };
    case "error":
      return {
        icon: AlertCircle,
        bgColor: "bg-red-50",
        borderColor: "border-red-500",
        textColor: "text-red-800",
        iconColor: "text-red-500",
        title: "エラー発生",
        message: "レビュー実行中にエラーが発生しました。",
      };
    default:
      return {
        icon: Info,
        bgColor: "bg-gray-50",
        borderColor: "border-gray-500",
        textColor: "text-gray-800",
        iconColor: "text-gray-500",
        title: "不明な状態",
        message: null,
      };
  }
}

/**
 * 評定に応じたバッジスタイルを取得
 */
function getEvaluationBadgeStyle(evaluation: string | null): string {
  if (!evaluation) return "bg-gray-100 text-gray-800";

  const normalized = evaluation.toUpperCase();
  if (normalized === "A") return "bg-green-100 text-green-800";
  if (normalized === "B") return "bg-yellow-100 text-yellow-800";
  if (normalized === "C") return "bg-red-100 text-red-800";
  if (normalized === "-") return "bg-gray-100 text-gray-600";

  return "bg-blue-100 text-blue-800";
}

/**
 * レビュー結果クライアントコンポーネント
 */
export function ReviewResultsClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  targetId,
  reviewTarget,
  canRetry,
}: ReviewResultsClientProps) {
  const router = useRouter();

  // ポーリングフック（router.refreshで更新）
  const { isPolling } = useReviewResultsPolling({
    currentStatus: reviewTarget.status,
  });

  // アクションボタンを無効にすべきか（キュー待機中またはレビュー中は無効化）
  const isActionsDisabled =
    reviewTarget.status === "reviewing" || reviewTarget.status === "queued";

  // ステータスバナー設定
  const bannerConfig = getStatusBannerConfig(reviewTarget.status);
  const StatusIcon = bannerConfig.icon;

  // レビュー結果を作成日時順にソート
  const sortedResults = useMemo(() => {
    return [...reviewTarget.reviewResults].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [reviewTarget.reviewResults]);

  // 完了日時をフォーマット
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

  // CSV出力アクション
  const { execute: executeExportCsv, isExecuting: isExporting } = useAction(
    exportReviewResultsToCsvAction,
    {
      onSuccess: (result) => {
        if (result.data?.csvContent) {
          // BlobからダウンロードURLを生成
          const blob = new Blob([result.data.csvContent], {
            type: "text/csv;charset=utf-8",
          });
          const url = URL.createObjectURL(blob);

          // ダウンロードリンクを作成してクリック
          const a = document.createElement("a");
          a.href = url;
          const dateStr = new Date().toISOString().slice(0, 10);
          a.download = `review_results_${reviewTarget.name}_${dateStr}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showSuccess(
            formatClientMessage("SUCCESS_REVIEW_RESULT_EXPORTED", {
              count: result.data.exportedCount,
            }),
          );
        }
      },
      onError: ({ error: actionError }) => {
        const message = extractServerErrorMessage(
          actionError,
          "エクスポートに失敗しました",
        );
        showError(message);
      },
    },
  );

  // CSV出力ハンドラー
  const handleExportCsv = useCallback(() => {
    executeExportCsv({ reviewTargetId: targetId });
  }, [targetId, executeExportCsv]);

  // リトライハンドラー（今後実装）
  const handleRetry = useCallback(() => {
    // TODO: リトライ機能を実装
    router.push(
      `/projects/${projectId}/spaces/${spaceId}/review/${targetId}/retry`,
    );
  }, [router, projectId, spaceId, targetId]);

  // Q&Aハンドラー（今後実装）
  const handleQA = useCallback(() => {
    // TODO: Q&A機能を実装
    router.push(
      `/projects/${projectId}/spaces/${spaceId}/review/${targetId}/qa`,
    );
  }, [router, projectId, spaceId, targetId]);

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: projectName, href: `/projects/${projectId}/spaces` },
            {
              label: spaceName,
              href: `/projects/${projectId}/spaces/${spaceId}`,
            },
            { label: reviewTarget.name },
          ]}
        />

        {/* Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {reviewTarget.name}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleQA}
              disabled={isActionsDisabled}
              className="flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Q&A
            </Button>
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={isActionsDisabled || !canRetry}
              className="flex items-center gap-2"
              title={!canRetry ? "リトライに必要な情報がありません" : undefined}
            >
              <RefreshCw className="w-4 h-4" />
              リトライ
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={isActionsDisabled || isExporting}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "出力中..." : "CSV出力"}
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        <div
          className={`${bannerConfig.bgColor} border-l-4 ${bannerConfig.borderColor} p-4 mb-6 rounded`}
        >
          <div className="flex items-start">
            <StatusIcon
              className={`h-5 w-5 ${bannerConfig.iconColor} mt-0.5 ${
                bannerConfig.animate ? "animate-spin" : ""
              }`}
            />
            <div className="ml-3 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p
                    className={`text-sm ${bannerConfig.textColor} font-medium`}
                  >
                    {bannerConfig.title}
                    {isPolling && (
                      <span className="ml-2 text-xs text-gray-500">
                        (自動更新中)
                      </span>
                    )}
                  </p>
                  {bannerConfig.message && (
                    <p
                      className={`mt-1 text-sm ${bannerConfig.textColor.replace("800", "700")}`}
                    >
                      {bannerConfig.message}
                    </p>
                  )}
                  {reviewTarget.status === "completed" && (
                    <p
                      className={`mt-1 text-sm ${bannerConfig.textColor.replace("800", "700")}`}
                    >
                      レビュー完了日時: {formatDate(reviewTarget.updatedAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
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
                    チェック項目
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"
                  >
                    評定
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    コメント
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedResults.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      {reviewTarget.status === "reviewing" ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>レビュー実行中...</span>
                        </div>
                      ) : (
                        "レビュー結果がありません"
                      )}
                    </td>
                  </tr>
                ) : (
                  sortedResults.map((result, index) => {
                    const hasError = !!result.errorMessage;

                    return (
                      <tr
                        key={result.id}
                        className="hover:bg-gray-50 transition duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {result.checkListItemContent}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {hasError ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              エラー
                            </span>
                          ) : result.evaluation ? (
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getEvaluationBadgeStyle(
                                result.evaluation,
                              )}`}
                            >
                              {result.evaluation}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="max-h-24 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                            {hasError ? (
                              <span className="text-red-600">
                                {result.errorMessage}
                              </span>
                            ) : result.comment ? (
                              <span className="whitespace-pre-wrap">
                                {result.comment}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
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
                レビュー結果の活用方法
              </p>
              <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>「リトライ」で改善後に再度レビューを実行できます</li>
                <li>「CSV出力」で結果をExcelなどで加工・共有できます</li>
                <li>「Q&A」でレビュー結果について質問できます</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ReviewResultsClient;
