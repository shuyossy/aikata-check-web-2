import {
  createSafeActionClient,
  DEFAULT_SERVER_ERROR_MESSAGE,
} from "next-safe-action";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  normalizeUnknownError,
  toPayload,
  unauthorizedError,
  forbiddenError,
} from "./error";
import { createContextLogger, getLogger } from "./logger";
import { runWithRequestContext } from "./requestContext";
import { v4 as uuidv4 } from "uuid";

/**
 * 認証済みユーザコンテキスト
 */
export interface AuthContext {
  /** DBのユーザーID（UUID） */
  userId: string;
  /** Keycloakの社員ID */
  employeeId: string;
  /** 表示名 */
  displayName: string;
  /** 管理者フラグ */
  isAdmin: boolean;
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
    // シリアライザーが自動でエラーオブジェクトをシリアライズ
    getLogger().error({ err: error }, "Error captured in baseAction");
    const appError = normalizeUnknownError(error);

    // エラーログ出力（シリアライザーが自動でシリアライズ）
    getLogger().error({ err: appError }, "Action error occurred");

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
 * - AsyncLocalStorageにリクエストコンテキストを設定（全レイヤーでgetLogger()でアクセス可能）
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
    userId: session.user.id,
    employeeId: session.user.employeeId,
    displayName: session.user.displayName,
    isAdmin: session.user.isAdmin ?? false,
    requestId,
  };

  contextLogger.info("Authenticated action started");

  // AsyncLocalStorageにリクエストコンテキストを設定して実行
  return runWithRequestContext(
    { requestId, employeeId: session.user.employeeId },
    () =>
      next({
        ctx: {
          auth: authContext,
        },
      })
  );
});

/**
 * 認証不要の公開アクション用の基底クラス
 * - AsyncLocalStorageにリクエストコンテキスト（requestIdのみ）を設定
 * - 全レイヤーでgetLogger()でアクセス可能
 */
export const publicAction = baseAction.use(async ({ next }) => {
  const requestId = uuidv4();

  // AsyncLocalStorageにリクエストコンテキストを設定して実行
  return runWithRequestContext({ requestId }, () => next());
});

/**
 * 管理者専用アクション用の基底クラス
 * - 認証に加えて、管理者フラグのチェックを実施
 * - 管理者でない場合はForbiddenエラーをスロー
 */
export const adminAction = authenticatedAction.use(async ({ next }) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    throw forbiddenError();
  }

  return next();
});
