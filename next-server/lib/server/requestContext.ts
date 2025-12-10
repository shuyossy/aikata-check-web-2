import { AsyncLocalStorage } from "async_hooks";

/**
 * リクエストコンテキスト
 * リクエストスコープで保持する情報
 */
export interface RequestContext {
  /** リクエストID（ユニークな識別子） */
  requestId: string;
  /** 認証済みユーザのemployeeId（未認証の場合はundefined） */
  employeeId?: string;
}

/**
 * AsyncLocalStorageインスタンス
 * リクエストスコープでコンテキストを管理
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * 現在のリクエストコンテキストを取得
 * @returns RequestContext または undefined（コンテキスト外の場合）
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * リクエストコンテキストを設定してコールバックを実行
 * @param context リクエストコンテキスト
 * @param callback 実行するコールバック
 * @returns コールバックの戻り値
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T
): T {
  return requestContextStorage.run(context, callback);
}
