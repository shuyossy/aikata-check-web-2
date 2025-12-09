import {
  createSafeActionClient,
  DEFAULT_SERVER_ERROR_MESSAGE,
} from "next-safe-action";
import { normalizeUnknownError, toPayload } from "./error";
import { logger } from "./logger";

/**
 * next-safe-actionの基底クラス
 * - エラーハンドリングの一元管理
 * - Zod検証の自動実行
 * - ログ出力
 */
export const baseAction = createSafeActionClient({
  // エラーハンドリング
  handleServerError(error) {
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
 * TODO: NextAuth実装後に認証チェックを追加
 */
export const authenticatedAction = baseAction;

/**
 * 認証不要の公開アクション用の基底クラス
 */
export const publicAction = baseAction;
