import { IntlMessageFormat } from "intl-messageformat";
import { template } from "@/messages/ja/template";

// テンプレートキーの型定義
export type ClientMessageCode = keyof typeof template;

// パラメータの型定義
export type MessageParams = Record<string, unknown>;

/**
 * クライアントサイドでメッセージをフォーマットする
 * @param code メッセージコード
 * @param params パラメータ（オプション）
 * @returns フォーマット済みメッセージ
 */
export function formatClientMessage(
  code: ClientMessageCode,
  params: MessageParams = {},
): string {
  const message = template[code];
  if (!message) {
    return template.UNKNOWN_ERROR;
  }
  const mf = new IntlMessageFormat(message, "ja");
  return mf.format(params) as string;
}

/**
 * メッセージを取得する（パラメータなし）
 * @param code メッセージコード
 * @returns メッセージ文字列
 */
export function getMessage(code: ClientMessageCode): string {
  return template[code] ?? template.UNKNOWN_ERROR;
}
