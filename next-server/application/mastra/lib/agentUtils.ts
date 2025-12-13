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
