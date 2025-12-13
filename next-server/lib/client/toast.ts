import { toast } from "sonner";

/**
 * Toast通知ユーティリティ
 * アプリ全体で一貫したtoast表示を提供する
 */

/**
 * エラーメッセージを表示する
 * 自動削除されないため、ユーザーが手動で閉じる必要がある
 */
export const showError = (message: string) => {
  toast.error(message, {
    duration: Infinity, // 自動削除しない
  });
};

/**
 * 情報メッセージを表示する
 */
export const showInfo = (message: string) => {
  toast.info(message);
};

/**
 * 成功メッセージを表示する
 */
export const showSuccess = (message: string) => {
  toast.success(message);
};

/**
 * 警告メッセージを表示する
 */
export const showWarning = (message: string) => {
  toast.warning(message);
};
