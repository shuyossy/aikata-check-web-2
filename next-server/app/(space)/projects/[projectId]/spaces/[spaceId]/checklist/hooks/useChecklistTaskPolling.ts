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
 * チェックリスト生成タスクのステータス
 */
export const TASK_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
} as const;

/**
 * チェックリストタスクポーリングフックの引数
 */
interface UseChecklistTaskPollingProps {
  /** 現在のタスクステータス（queued/processing/null） */
  taskStatus: string | null;
}

/**
 * ポーリングが必要なステータスか判定
 */
function shouldPollForStatus(status: string | null): boolean {
  return status === TASK_STATUS.QUEUED || status === TASK_STATUS.PROCESSING;
}

/**
 * チェックリスト生成タスクポーリングフック
 * キュー待機中または処理中のステータスの場合、10秒間隔でrouter.refresh()を呼び出し
 * RSCを再実行して最新のタスク状態とチェックリストを取得する
 */
export function useChecklistTaskPolling({
  taskStatus,
}: UseChecklistTaskPollingProps) {
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ポーリングのセットアップ・クリーンアップ
  useEffect(() => {
    const shouldPoll = shouldPollForStatus(taskStatus);

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
  }, [taskStatus, router]);

  // isPollingはポーリングが必要なステータスかどうかで判定
  return { isPolling: shouldPollForStatus(taskStatus) };
}
