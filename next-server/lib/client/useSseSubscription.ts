"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * SSE接続状態
 */
export type SseConnectionState = "connecting" | "connected" | "disconnected" | "error";

/**
 * SSE購読フックのオプション
 */
export interface UseSseSubscriptionOptions<T> {
  /** SSEエンドポイントのURL */
  url: string;
  /** イベント受信時のコールバック */
  onEvent: (event: T) => void;
  /** 接続エラー時のコールバック */
  onError?: (error: Event) => void;
  /** 接続確立時のコールバック */
  onConnected?: () => void;
  /** 接続切断時のコールバック */
  onDisconnected?: () => void;
  /** 自動的に購読を開始するか（デフォルト: true） */
  autoConnect?: boolean;
}

/**
 * SSE購読フックの戻り値
 */
export interface UseSseSubscriptionResult {
  /** 現在の接続状態 */
  connectionState: SseConnectionState;
  /** 接続を開始する */
  connect: () => void;
  /** 接続を切断する */
  disconnect: () => void;
}

/**
 * SSE購読用カスタムフック
 * サーバーから送信されるイベントをリアルタイムで受信する
 *
 * @example
 * ```tsx
 * const { connectionState, connect, disconnect } = useSseSubscription({
 *   url: `/api/sse/qa/${qaHistoryId}`,
 *   onEvent: (event) => {
 *     console.log('Received event:', event);
 *   },
 *   onError: (error) => {
 *     console.error('SSE error:', error);
 *   },
 * });
 * ```
 */
export function useSseSubscription<T>({
  url,
  onEvent,
  onError,
  onConnected,
  onDisconnected,
  autoConnect = true,
}: UseSseSubscriptionOptions<T>): UseSseSubscriptionResult {
  const [connectionState, setConnectionState] = useState<SseConnectionState>("disconnected");
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);

  // コールバックの参照を更新（再レンダリング時に最新のコールバックを使用するため）
  useEffect(() => {
    onEventRef.current = onEvent;
    onErrorRef.current = onError;
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
  }, [onEvent, onError, onConnected, onDisconnected]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnectionState("disconnected");
      onDisconnectedRef.current?.();
    }
  }, []);

  const connect = useCallback(() => {
    // 既存の接続がある場合は切断
    disconnect();

    setConnectionState("connecting");

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      // onopen は EventSource が接続を確立したときに呼ばれるが、
      // サーバーから 'connected' イベントを受信して初めて完全な接続とみなす
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T & { type?: string };

        // 接続確認イベントの場合
        if (data.type === "connected") {
          setConnectionState("connected");
          onConnectedRef.current?.();
          return;
        }

        // 通常のイベント
        onEventRef.current(data);
      } catch (error) {
        console.error("Failed to parse SSE event:", error);
      }
    };

    eventSource.onerror = (error) => {
      setConnectionState("error");
      onErrorRef.current?.(error);

      // EventSource は自動的に再接続を試みるが、
      // 完全にクローズされた場合は disconnected に設定
      if (eventSource.readyState === EventSource.CLOSED) {
        setConnectionState("disconnected");
        onDisconnectedRef.current?.();
      }
    };
  }, [url, disconnect]);

  // 自動接続とクリーンアップ
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
  };
}
