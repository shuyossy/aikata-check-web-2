"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * ポーリング間隔（ミリ秒）
 */
const POLLING_INTERVAL = 10000;

/**
 * レビュー実行中のステータス
 */
const REVIEWING_STATUS = "reviewing";

/**
 * レビュー結果ポーリングフックの引数
 */
interface UseReviewResultsPollingProps {
  /** 現在のステータス */
  currentStatus: string;
}

/**
 * レビュー結果ポーリングフック
 * レビュー実行中のステータスの場合、10秒間隔でrouter.refresh()を呼び出し
 * RSCを再実行して最新のレビュー結果を取得する
 */
export function useReviewResultsPolling({
  currentStatus,
}: UseReviewResultsPollingProps) {
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ポーリングのセットアップ・クリーンアップ
  useEffect(() => {
    // レビュー実行中でない場合はポーリングしない
    if (currentStatus !== REVIEWING_STATUS) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // ポーリング開始
    intervalRef.current = setInterval(() => {
      router.refresh();
    }, POLLING_INTERVAL);

    // クリーンアップ
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentStatus, router]);

  // isPollingはステータスがreviewingかどうかで判定
  return { isPolling: currentStatus === REVIEWING_STATUS };
}
