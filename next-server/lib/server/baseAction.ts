import {
  createSafeActionClient,
  DEFAULT_SERVER_ERROR_MESSAGE,
} from "next-safe-action";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { normalizeUnknownError, toPayload, unauthorizedError } from "./error";
import { logger, createContextLogger } from "./logger";
import { v4 as uuidv4 } from "uuid";

/**
 * エラーを安全にシリアライズするヘルパー関数
 * JavaScriptのErrorオブジェクトのプロパティは列挙可能ではないため、
 * JSONシリアライズすると{}になってしまう問題を解決する
 */
function serializeError(error: unknown): object {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { value: error };
}

/**
 * 認証済みユーザコンテキスト
 */
export interface AuthContext {
  /** Keycloakの社員ID */
  employeeId: string;
  /** 表示名 */
  displayName: string;
  /** リクエストID */
  requestId: string;
}

/**
 * next-safe-actionの基底クラス
 * - エラーハンドリングの一元管理
 * - Zod検証の自動実行
 * - ログ出力
 */
export const baseAction = createSafeActionClient({
  // エラーハンドリング
  handleServerError(error) {
    logger.error({ rawError: serializeError(error) }, "Error captured in baseAction");
    const appError = normalizeUnknownError(error);

    // エラーログ出力
    logger.error(
      {
        errorCode: appError.errorCode,
        messageCode: appError.messageCode,
        expose: appError.expose,
        cause: appError.couse,
      },
      "Action error occurred",
    );

    // クライアントに返すエラーメッセージ
    if (appError.expose) {
      return toPayload(appError);
    }

    // exposeがfalseの場合はデフォルトメッセージ
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

/**
 * 認証が必要なアクション用の基底クラス
 * - セッションから認証情報を取得
 * - 未認証の場合はエラーをスロー
 * - 認証情報をコンテキストに追加
 */
export const authenticatedAction = baseAction.use(async ({ next }) => {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw unauthorizedError();
  }

  const requestId = uuidv4();
  const contextLogger = createContextLogger({
    requestId,
    employeeId: session.user.employeeId,
  });

  // 認証情報をコンテキストに追加
  const authContext: AuthContext = {
    employeeId: session.user.employeeId,
    displayName: session.user.displayName,
    requestId,
  };

  contextLogger.info("Authenticated action started");

  return next({
    ctx: {
      auth: authContext,
      logger: contextLogger,
    },
  });
});

/**
 * 認証不要の公開アクション用の基底クラス
 */
export const publicAction = baseAction;
