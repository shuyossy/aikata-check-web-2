import pino, { Logger } from "pino";
import { getRequestContext } from "./requestContext";

const base = pino({
  level: getLogLevel(),
});

/**
 * コンテキスト情報を含むロガーを作成
 * @param context リクエストID、ユーザー情報などのコンテキスト
 * @returns コンテキスト付きロガー
 */
export interface LogContext {
  requestId: string;
  employeeId?: string;
}

export function createContextLogger(context: LogContext): Logger {
  return base.child({
    requestId: context.requestId,
    employeeId: context.employeeId,
  });
}

export function getLogLevel() {
  let logLevel: "debug" | "info";
  if (process.env.AIKATA_LOG_DEBUG !== undefined) {
    // 環境変数が設定されていれば強制 debug
    logLevel = "debug";
  } else {
    // 通常は NODE_ENV で切り替え
    logLevel = process.env.NODE_ENV === "production" ? "info" : "debug";
  }
  return logLevel;
}

/**
 * 現在のリクエストコンテキストに基づいたロガーを取得
 *
 * - コンテキストが存在する場合: requestId, employeeIdを含むロガー
 * - コンテキストが存在しない場合: ベースロガー
 *
 * 全レイヤーでこの関数を使用することで、引数なしでコンテキスト付きロガーを取得可能
 *
 * @returns コンテキスト付きロガーまたはベースロガー
 */
export function getLogger(): Logger {
  const context = getRequestContext();

  if (context) {
    return createContextLogger({
      requestId: context.requestId,
      employeeId: context.employeeId,
    });
  }

  // コンテキスト外の場合はベースロガーを返す
  return base;
}
