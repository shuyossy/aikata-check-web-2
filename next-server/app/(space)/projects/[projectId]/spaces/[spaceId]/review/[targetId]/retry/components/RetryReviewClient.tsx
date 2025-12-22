"use client";

import { useState, useCallback, useMemo } from "react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  AlertCircle,
  Info,
  HelpCircle,
  Loader2,
  Settings,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormSection } from "@/components/ui/form-section";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  ReviewSettingsEditor,
  ReviewSettingsValue,
  EvaluationCriterionItem,
  ReviewTypeSelector,
  ReviewTypeValue,
} from "@/components/reviewSpace";
import {
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_COMMENT_FORMAT,
} from "@/domain/reviewSpace";
import {
  showError,
  showSuccess,
  validateEvaluationCriteria,
  getMessage,
} from "@/lib/client";
import { retryReviewAction } from "../actions";
import { extractServerErrorMessage } from "@/hooks";

/**
 * リトライ範囲
 */
type RetryScope = "failed" | "all";

/**
 * チェックリストソース（全項目リトライ時のみ）
 */
type ChecklistSource = "previous" | "latest";

/**
 * リトライ時のレビュー種別（APIは対象外）
 */
type RetryReviewType = Exclude<ReviewTypeValue, "api">;

/**
 * リトライ不可の理由
 */
type RetryNotAllowedReason = "api_review";

interface RetryInfoData {
  canRetry: boolean;
  reviewType: RetryReviewType | null;
  previousSettings: {
    additionalInstructions: string | null;
    concurrentReviewItems?: number;
    commentFormat: string | null;
    evaluationCriteria?: EvaluationCriterionItem[];
  } | null;
  failedItemCount: number;
  totalItemCount: number;
  hasChecklistDiff: boolean;
  snapshotChecklistCount: number;
  currentChecklistCount: number;
  /** リトライ不可の理由 */
  retryNotAllowedReason?: RetryNotAllowedReason;
}

interface RetryReviewClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  targetId: string;
  targetName: string;
  retryInfo: RetryInfoData;
}

/**
 * リトライレビュークライアントコンポーネント
 */
export function RetryReviewClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  targetId,
  targetName,
  retryInfo,
}: RetryReviewClientProps) {
  const router = useRouter();

  // リトライ範囲
  const [retryScope, setRetryScope] = useState<RetryScope>(
    retryInfo.failedItemCount > 0 ? "failed" : "all",
  );

  // チェックリストソース（全項目リトライ時のみ）
  const [checklistSource, setChecklistSource] =
    useState<ChecklistSource>("previous");

  // レビュー種別
  const [reviewType, setReviewType] = useState<RetryReviewType>(
    retryInfo.reviewType ?? "small",
  );

  // レビュー設定
  const [reviewSettings, setReviewSettings] = useState<ReviewSettingsValue>({
    additionalInstructions:
      retryInfo.previousSettings?.additionalInstructions ?? "",
    concurrentReviewItems:
      retryInfo.previousSettings?.concurrentReviewItems ?? 1,
    commentFormat:
      retryInfo.previousSettings?.commentFormat ?? DEFAULT_COMMENT_FORMAT,
    evaluationCriteria:
      retryInfo.previousSettings?.evaluationCriteria ??
      DEFAULT_EVALUATION_CRITERIA,
  });

  // リトライ実行アクション
  const { execute: executeRetry, isExecuting } = useAction(retryReviewAction, {
    onSuccess: () => {
      showSuccess(getMessage("SUCCESS_RETRY_STARTED"));
      // レビュー結果画面に遷移
      router.push(
        `/projects/${projectId}/spaces/${spaceId}/review/${targetId}`,
      );
    },
    onError: ({ error: actionError }) => {
      const message = extractServerErrorMessage(
        actionError,
        "リトライ実行に失敗しました",
      );
      showError(message);
    },
  });

  // リトライ対象項目数を計算
  const retryItemCount = useMemo(() => {
    if (retryScope === "failed") {
      return retryInfo.failedItemCount;
    }
    // 全項目リトライの場合
    if (checklistSource === "latest") {
      return retryInfo.currentChecklistCount;
    }
    return retryInfo.snapshotChecklistCount;
  }, [retryScope, checklistSource, retryInfo]);

  // 実行ボタンの有効/無効判定
  const canExecute = useCallback(() => {
    // リトライ可能でない場合
    if (!retryInfo.canRetry) return false;

    // リトライ対象がない場合
    if (retryItemCount === 0) return false;

    // 評価基準が有効か
    if (!validateEvaluationCriteria(reviewSettings.evaluationCriteria))
      return false;

    return true;
  }, [retryInfo.canRetry, retryItemCount, reviewSettings.evaluationCriteria]);

  // 実行
  const handleExecute = useCallback(() => {
    if (!canExecute()) return;

    executeRetry({
      reviewTargetId: targetId,
      retryScope,
      useLatestChecklist: retryScope === "all" && checklistSource === "latest",
      reviewType,
      reviewSettings: {
        additionalInstructions: reviewSettings.additionalInstructions || null,
        concurrentReviewItems: reviewSettings.concurrentReviewItems,
        commentFormat: reviewSettings.commentFormat || null,
        evaluationCriteria: reviewSettings.evaluationCriteria,
      },
    });
  }, [
    canExecute,
    executeRetry,
    targetId,
    retryScope,
    checklistSource,
    reviewType,
    reviewSettings,
  ]);

  // リトライ不可の理由に応じたメッセージを取得
  const getRetryNotAllowedMessage = (): {
    title: string;
    description: string;
  } => {
    if (retryInfo.retryNotAllowedReason === "api_review") {
      return {
        title: "外部APIレビューはリトライできません",
        description:
          "外部APIレビューではリトライ機能を利用できません。新規でレビューを実行してください。",
      };
    }
    return {
      title: "リトライを実行できません",
      description:
        "このレビュー対象はリトライを実行できる状態ではありません。アップロードしたファイルが存在しないか、レビューが実行中の可能性があります。",
    };
  };

  // リトライ不可の場合の表示
  if (!retryInfo.canRetry) {
    const { title, description } = getRetryNotAllowedMessage();
    return (
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6">
          <Breadcrumb
            items={[
              { label: projectName, href: `/projects/${projectId}/spaces` },
              {
                label: spaceName,
                href: `/projects/${projectId}/spaces/${spaceId}`,
              },
              {
                label: targetName,
                href: `/projects/${projectId}/spaces/${spaceId}/review/${targetId}`,
              },
              { label: "リトライ" },
            ]}
          />

          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertCircle className="w-8 h-8" />
                <h3 className="text-xl font-bold">{title}</h3>
              </div>
              <p className="text-gray-600 mb-6">{description}</p>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    `/projects/${projectId}/spaces/${spaceId}/review/${targetId}`,
                  )
                }
              >
                レビュー結果に戻る
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
            {
              label: targetName,
              href: `/projects/${projectId}/spaces/${spaceId}/review/${targetId}`,
            },
            { label: "リトライ" },
          ]}
        />

        {/* Main Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  レビューをリトライ
                </h3>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </span>
              </div>
              <p className="text-gray-600">
                「{targetName}
                」のレビューをリトライします。前回の設定を引き継いで実行できます。
              </p>
            </div>

            {/* レビュー結果サマリー */}
            <div className="bg-gray-50 rounded-lg p-4 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">
                  前回のレビュー結果
                </h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {retryInfo.totalItemCount}
                  </div>
                  <div className="text-sm text-gray-500">総項目数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {retryInfo.totalItemCount - retryInfo.failedItemCount}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    成功
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {retryInfo.failedItemCount}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" />
                    失敗
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {retryItemCount}
                  </div>
                  <div className="text-sm text-gray-500">リトライ対象</div>
                </div>
              </div>
            </div>

            {/* Section 1: リトライ範囲 */}
            <FormSection sectionNumber={1} title="リトライ範囲">
              <RadioGroup
                value={retryScope}
                onValueChange={(v) => setRetryScope(v as RetryScope)}
                className="space-y-3"
              >
                {/* 失敗項目のみ */}
                <div
                  className={`flex items-start space-x-3 p-3 border rounded-lg bg-white hover:bg-gray-50 ${
                    retryInfo.failedItemCount === 0
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <RadioGroupItem
                    value="failed"
                    id="scope-failed"
                    className="mt-1"
                    disabled={retryInfo.failedItemCount === 0}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="scope-failed"
                      className={`font-medium ${
                        retryInfo.failedItemCount === 0
                          ? "text-gray-400"
                          : "cursor-pointer"
                      }`}
                    >
                      失敗項目のみリトライ
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({retryInfo.failedItemCount}件)
                      </span>
                    </Label>
                    <p className="text-sm text-gray-500">
                      前回エラーになったチェック項目のみ再レビューします
                    </p>
                  </div>
                </div>

                {/* 全項目 */}
                <div className="flex items-start space-x-3 p-3 border rounded-lg bg-white hover:bg-gray-50">
                  <RadioGroupItem value="all" id="scope-all" className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor="scope-all"
                      className="font-medium cursor-pointer"
                    >
                      全ての項目をリトライ
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({retryInfo.snapshotChecklistCount}件)
                      </span>
                    </Label>
                    <p className="text-sm text-gray-500">
                      全てのチェック項目を再レビューします
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {/* チェックリスト選択（全項目リトライ時かつ差分がある場合のみ） */}
              {retryScope === "all" && retryInfo.hasChecklistDiff && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        チェックリストに変更があります
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        前回のレビュー以降、チェックリストが更新されています。
                        どちらを使用しますか？
                      </p>
                    </div>
                  </div>
                  <RadioGroup
                    value={checklistSource}
                    onValueChange={(v) =>
                      setChecklistSource(v as ChecklistSource)
                    }
                    className="space-y-2 ml-7"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="previous"
                        id="checklist-previous"
                      />
                      <Label
                        htmlFor="checklist-previous"
                        className="text-sm cursor-pointer"
                      >
                        前回のチェックリスト
                        <span className="ml-2 text-gray-500">
                          ({retryInfo.snapshotChecklistCount}件)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="latest" id="checklist-latest" />
                      <Label
                        htmlFor="checklist-latest"
                        className="text-sm cursor-pointer"
                      >
                        最新のチェックリスト
                        <span className="ml-2 text-gray-500">
                          ({retryInfo.currentChecklistCount}件)
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </FormSection>

            {/* Section 2: レビュー種別 */}
            <FormSection sectionNumber={2} title="レビュー種別">
              <ReviewTypeSelector
                value={reviewType}
                onChange={(v) => {
                  // APIは選択不可なのでRetryReviewTypeに限定
                  if (v !== "api") {
                    setReviewType(v);
                  }
                }}
                disabled={isExecuting}
                previousType={retryInfo.reviewType}
                showApiOption={false}
              />
            </FormSection>

            {/* Section 3: レビュー設定 */}
            <FormSection
              sectionNumber={3}
              title="レビュー設定"
              titleIcon={<Settings className="w-4 h-4 text-gray-400" />}
            >
              <ReviewSettingsEditor
                value={reviewSettings}
                onChange={setReviewSettings}
                disabled={isExecuting}
              />
            </FormSection>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    `/projects/${projectId}/spaces/${spaceId}/review/${targetId}`,
                  )
                }
                disabled={isExecuting}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleExecute}
                disabled={!canExecute() || isExecuting}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    リトライ実行中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    リトライを実行 ({retryItemCount}件)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-6 bg-gray-100 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  リトライ実行のヒント
                </p>
                <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>
                    失敗項目のみリトライすると、成功した項目の結果は保持されます
                  </li>
                  <li>
                    全項目リトライを選択すると、全ての結果が再生成されます
                  </li>
                  <li>
                    レビュー設定は前回の設定を引き継いでいます。必要に応じて変更できます
                  </li>
                  <li>
                    ドキュメントは前回アップロードしたものがキャッシュから使用されます
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RetryReviewClient;
