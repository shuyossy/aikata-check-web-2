import { RuntimeContext } from "@mastra/core/di";

/**
 * RuntimeContextを作成するユーティリティ関数
 * @param values 初期値として設定するオブジェクト
 * @returns RuntimeContext
 */
export function createRuntimeContext<T extends Record<string, unknown>>(
  values: T,
): RuntimeContext<T> {
  const context = new RuntimeContext<T>();
  for (const [key, value] of Object.entries(values)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context.set(key as any, value as any);
  }
  return context;
}

/**
 * AIのfinishReasonを元に正常終了かどうかを判定する関数
 * @param finishReason AI応答のfinishReason
 * @returns 成功判定と理由のオブジェクト
 */
export function judgeFinishReason(finishReason?: string): {
  success: boolean;
  reason: string;
} {
  if (!finishReason) {
    return { success: true, reason: "不明な終了理由" };
  }
  switch (finishReason) {
    case "stop":
      return { success: true, reason: "正常終了" };
    case "length":
      return {
        success: false,
        reason: "AIモデルの最大出力コンテキストを超えました",
      };
    case "content-filter":
      return {
        success: false,
        reason: "コンテンツフィルターにより出力が制限されました",
      };
    case "error":
      return { success: false, reason: "AIモデルで不明なエラーが発生しました" };
    default:
      return { success: true, reason: "不明な終了理由" };
  }
}
