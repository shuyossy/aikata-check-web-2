/**
 * 日付フォーマット関連のユーティリティ関数
 */

/**
 * 日付をYYYY/MM/DD形式でフォーマット
 * UTCベースでフォーマットしてサーバー/クライアント間の一貫性を保証
 */
export function formatDate(dateString: string | Date): string {
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}
