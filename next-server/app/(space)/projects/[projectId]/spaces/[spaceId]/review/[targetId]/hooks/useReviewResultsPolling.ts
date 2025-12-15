"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { POLLING_INTERVALS } from "@/lib/client";

/**
 * ポーリング間隔（ミリ秒）
 * @deprecated POLLING_INTERVALS.TASK_STATUS を使用してください
 */
export const POLLING_INTERVAL = POLLING_INTERVALS.TASK_STATUS;

/**
 * レビュー実行中のステータス
 */
export const REVIEWING_STATUS = "reviewing";

/**
 * キュー待機中のステータス
 */
export const QUEUED_STATUS = "queued";

/**
 * レビュー結果ポーリングフックの引数
 */
interface UseReviewResultsPollingProps {
  /** 現在のステータス */
  currentStatus: string;
}

/**
 * ポーリングが必要なステータスか判定
 */
function shouldPollForStatus(status: string): boolean {
  return status === REVIEWING_STATUS || status === QUEUED_STATUS;
}

/**
 * レビュー結果ポーリングフック
 * レビュー実行中またはキュー待機中のステータスの場合、10秒間隔でrouter.refresh()を呼び出し
 * RSCを再実行して最新のレビュー結果を取得する
 */
export function useReviewResultsPolling({
  currentStatus,
}: UseReviewResultsPollingProps) {
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ポーリングのセットアップ・クリーンアップ
  useEffect(() => {
    const shouldPoll = shouldPollForStatus(currentStatus);

    // ポーリングが不要な場合は停止
    if (!shouldPoll) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // ポーリング開始
    intervalRef.current = setInterval(() => {
      try {
        router.refresh();
      } catch (error) {
        // ネットワークエラー等が発生してもポーリングを継続
        console.error("Polling refresh failed:", error);
      }
    }, POLLING_INTERVAL);

    // クリーンアップ
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentStatus, router]);

  // isPollingはポーリングが必要なステータスかどうかで判定
  return { isPolling: shouldPollForStatus(currentStatus) };
}
