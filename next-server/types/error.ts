/**
 * アプリ全体で使うエラーコード。
 * UI 側の文言切り替えや翻訳キーにも使えます。
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "EXTERNAL_SERVICE"
  | "INTERNAL"
  | "AI_API"
  | "DOMAIN_VALIDATION_ERROR"
  | "DOMAIN_ERROR";

export type ErrorStatusCodeMap = {
  [key in ErrorCode]: number;
};

export const errorStatusCodeMap: ErrorStatusCodeMap = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VALIDATION: 422,
  EXTERNAL_SERVICE: 502,
  INTERNAL: 500,
  AI_API: 502,
  DOMAIN_VALIDATION_ERROR: 400,
  DOMAIN_ERROR: 500,
};

/**
 * クライアントへ返す標準エラー形
 * - code: エラーコード
 * - message: ユーザー向けの安全なメッセージ
 */
export type AppErrorPayload = {
  code: ErrorCode;
  message: string;
};
