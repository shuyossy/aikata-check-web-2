import pino, { Logger } from "pino";

const base = pino({
  level: getLogLevel(),
});

export function getMainLogger(): Logger {
  // TODO: 将来的にコンテキスト情報（リクエストIDやユーザーIDなど）を追加する場合はここでラップする
  return base;
}

export function getLogLevel() {
  let logLevel: "debug" | "info";
  if (process.env.DESIGN_GEN_LOG_DEBUG !== undefined) {
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
