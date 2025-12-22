"use client";

import { useState, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import { startApiReviewAction } from "../actions/startApiReview";
import { saveApiReviewResultsAction } from "../actions/saveApiReviewResults";
import { completeApiReviewAction } from "../actions/completeApiReview";
import { splitChecklistIntoChunks } from "@/lib/shared/checklistSplitter";
import type {
  ExternalReviewDocument,
  ExternalReviewCheckListItem,
  ExternalReviewSettings,
  ExternalReviewResponse,
} from "@/types/shared/externalReviewApi";
import {
  buildExternalReviewRequest,
  validateExternalReviewResponse,
} from "@/types/shared/externalReviewApi";
import { extractServerErrorMessage } from "@/hooks";
import { getMessage } from "@/lib/client";

/**
 * 外部APIレビューの進捗状態
 */
export interface ApiReviewProgress {
  /** 現在のチャンクインデックス（0始まり） */
  currentChunk: number;
  /** 総チャンク数 */
  totalChunks: number;
  /** 完了したチャンク数 */
  completedChunks: number;
  /** 現在のステータス */
  status:
    | "idle"
    | "starting"
    | "processing"
    | "completing"
    | "completed"
    | "error";
  /** エラーメッセージ */
  errorMessage?: string;
}

/**
 * 外部APIレビューの入力
 */
export interface ApiReviewInput {
  /** レビュースペースID */
  reviewSpaceId: string;
  /** レビュー対象名 */
  name: string;
  /** ドキュメント配列 */
  documents: ExternalReviewDocument[];
  /** 外部APIエンドポイントURL */
  apiEndpoint: string;
  /** レビュー設定 */
  reviewSettings?: {
    additionalInstructions?: string | null;
    concurrentReviewItems?: number;
    commentFormat?: string | null;
    evaluationCriteria?: Array<{ label: string; description: string }>;
  };
}

/**
 * 外部APIレビュー実行フック
 * チェックリスト分割→外部API呼び出し→結果保存のフローを管理する
 */
export function useApiReview() {
  // 進捗状態
  const [progress, setProgress] = useState<ApiReviewProgress>({
    currentChunk: 0,
    totalChunks: 0,
    completedChunks: 0,
    status: "idle",
  });

  // サーバーアクション
  const { executeAsync: startReview, isPending: isStarting } =
    useAction(startApiReviewAction);

  const { executeAsync: saveResults, isPending: isSaving } = useAction(
    saveApiReviewResultsAction,
  );

  const { executeAsync: completeReview, isPending: isCompleting } = useAction(
    completeApiReviewAction,
  );

  /**
   * 外部APIを呼び出す
   */
  const callExternalApi = useCallback(
    async (
      endpoint: string,
      documents: ExternalReviewDocument[],
      checkListItems: ExternalReviewCheckListItem[],
      reviewSettings?: ExternalReviewSettings,
    ): Promise<ExternalReviewResponse> => {
      const request = buildExternalReviewRequest(
        documents,
        checkListItems,
        reviewSettings,
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `External API call failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();
      const validation = validateExternalReviewResponse(data);

      if (!validation.success) {
        throw new Error(`Invalid API response: ${validation.error}`);
      }

      return validation.data!;
    },
    [],
  );

  /**
   * 外部APIレビューを実行
   */
  const execute = useCallback(
    async (
      input: ApiReviewInput,
    ): Promise<{
      reviewTargetId: string;
      success: boolean;
      errorMessage?: string;
    }> => {
      const { reviewSpaceId, name, documents, apiEndpoint, reviewSettings } =
        input;

      try {
        // 1. レビュー開始（サーバーアクション）
        setProgress({
          currentChunk: 0,
          totalChunks: 0,
          completedChunks: 0,
          status: "starting",
        });

        const startResult = await startReview({
          reviewSpaceId,
          name,
          reviewSettings,
        });

        if (!startResult?.data) {
          const errorMessage = extractServerErrorMessage(
            { serverError: startResult?.serverError },
            "レビュー開始に失敗しました",
          );
          setProgress((prev) => ({
            ...prev,
            status: "error",
            errorMessage,
          }));
          return { reviewTargetId: "", success: false, errorMessage };
        }

        const { reviewTargetId, checkListItems, concurrentReviewItems } =
          startResult.data;

        // 2. チェックリストを分割
        const chunks = splitChecklistIntoChunks(
          checkListItems,
          concurrentReviewItems,
        );
        const totalChunks = chunks.length;

        setProgress({
          currentChunk: 0,
          totalChunks,
          completedChunks: 0,
          status: "processing",
        });

        // 3. 各チャンクに対して外部APIを呼び出し、結果を保存
        // 「全てのチェックリストレビューが失敗した場合」のみエラーステータスにする
        // （一部成功があればcompleted）
        let totalSuccessCount = 0;
        let totalErrorCount = 0;
        let lastErrorMessage = "";

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          setProgress((prev) => ({
            ...prev,
            currentChunk: i,
          }));

          try {
            // チェック項目を外部API用の形式に変換
            const externalCheckListItems: ExternalReviewCheckListItem[] =
              chunk.items.map((item) => ({
                id: item.id,
                content: item.content,
              }));

            // 外部API呼び出し
            const apiResponse = await callExternalApi(
              apiEndpoint,
              documents,
              externalCheckListItems,
              reviewSettings
                ? {
                    additionalInstructions:
                      reviewSettings.additionalInstructions,
                    commentFormat: reviewSettings.commentFormat,
                    evaluationCriteria: reviewSettings.evaluationCriteria,
                  }
                : undefined,
            );

            // 成功/エラー結果をカウント
            const successCount = apiResponse.results.filter(
              (r) => !r.error,
            ).length;
            const errorCount = apiResponse.results.filter(
              (r) => r.error,
            ).length;
            totalSuccessCount += successCount;
            totalErrorCount += errorCount;

            // 結果を保存（サーバーアクション）
            const saveResult = await saveResults({
              reviewTargetId,
              results: apiResponse.results.map((result) => {
                // チェック項目IDからコンテンツを取得
                const checkItem = chunk.items.find(
                  (item) => item.id === result.checkListItemId,
                );
                return {
                  checkListItemId: result.checkListItemId,
                  checkListItemContent: checkItem?.content ?? "",
                  evaluation: result.evaluation,
                  comment: result.comment,
                  error: result.error,
                };
              }),
              chunkIndex: i,
              totalChunks,
            });

            if (!saveResult?.data) {
              const errorMessage = extractServerErrorMessage(
                { serverError: saveResult?.serverError },
                "結果の保存に失敗しました",
              );
              lastErrorMessage = errorMessage;
              console.error(`Chunk ${i} save failed:`, errorMessage);
            }
          } catch (error) {
            // チャンク全体のAPI呼び出し失敗時は、そのチャンク内の全項目をエラーとカウント
            totalErrorCount += chunk.items.length;
            lastErrorMessage =
              error instanceof Error
                ? error.message
                : getMessage("ERROR_UNKNOWN");
            console.error(`Chunk ${i} failed:`, error);
          }

          setProgress((prev) => ({
            ...prev,
            completedChunks: i + 1,
          }));
        }

        // 全て失敗した場合のみhasError=true（一部成功があればcompleted）
        const hasError = totalSuccessCount === 0 && totalErrorCount > 0;

        // 4. レビュー完了（サーバーアクション）
        setProgress((prev) => ({
          ...prev,
          status: "completing",
        }));

        const completeResult = await completeReview({
          reviewTargetId,
          hasError,
        });

        if (!completeResult?.data) {
          const errorMessage = extractServerErrorMessage(
            { serverError: completeResult?.serverError },
            "レビュー完了処理に失敗しました",
          );
          setProgress((prev) => ({
            ...prev,
            status: "error",
            errorMessage,
          }));
          return { reviewTargetId, success: false, errorMessage };
        }

        // 5. 完了
        setProgress({
          currentChunk: totalChunks - 1,
          totalChunks,
          completedChunks: totalChunks,
          status: hasError ? "error" : "completed",
          errorMessage: hasError ? lastErrorMessage : undefined,
        });

        return {
          reviewTargetId,
          success: !hasError,
          errorMessage: hasError ? lastErrorMessage : undefined,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : getMessage("ERROR_UNKNOWN");
        setProgress((prev) => ({
          ...prev,
          status: "error",
          errorMessage,
        }));
        return { reviewTargetId: "", success: false, errorMessage };
      }
    },
    [startReview, saveResults, completeReview, callExternalApi],
  );

  /**
   * 進捗をリセット
   */
  const reset = useCallback(() => {
    setProgress({
      currentChunk: 0,
      totalChunks: 0,
      completedChunks: 0,
      status: "idle",
    });
  }, []);

  return {
    /** 外部APIレビューを実行 */
    execute,
    /** 進捗状態 */
    progress,
    /** 実行中かどうか */
    isExecuting:
      isStarting ||
      isSaving ||
      isCompleting ||
      progress.status === "processing",
    /** 進捗をリセット */
    reset,
  };
}
