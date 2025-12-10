"use client";

import { useState, useCallback } from "react";

/**
 * サーバアクションエラーからエラーメッセージを抽出する
 * @param actionError next-safe-actionのエラーオブジェクト
 * @param fallbackMessage サーバエラーメッセージが取得できない場合のフォールバックメッセージ
 * @returns エラーメッセージ
 */
export function extractServerErrorMessage(
  actionError: { serverError?: unknown },
  fallbackMessage: string,
): string {
  const serverMessage =
    typeof actionError.serverError === "object" &&
    actionError.serverError !== null &&
    "message" in actionError.serverError
      ? (actionError.serverError as { message: string }).message
      : null;
  return serverMessage || fallbackMessage;
}

/**
 * サーバアクションのエラーハンドリングを共通化するフック
 */
export function useServerActionError() {
  const [error, setError] = useState<string | null>(null);

  /**
   * エラーをクリアする
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * サーバアクションのエラーをハンドリングする
   * @param actionError next-safe-actionのエラーオブジェクト
   * @param fallbackMessage サーバエラーメッセージが取得できない場合のフォールバックメッセージ
   */
  const handleError = useCallback(
    (actionError: { serverError?: unknown }, fallbackMessage: string) => {
      const message = extractServerErrorMessage(actionError, fallbackMessage);
      setError(message);
    },
    [],
  );

  return {
    error,
    setError,
    clearError,
    handleError,
  };
}
