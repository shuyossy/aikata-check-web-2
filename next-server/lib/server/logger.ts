import pino, { Logger } from "pino";

const base = pino({
  level: getLogLevel(),
});

export function getMainLogger(): Logger {
  return base;
}

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

// デフォルトエクスポート
export const logger = getMainLogger();
