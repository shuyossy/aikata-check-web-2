import { validate as uuidValidate, v4 as uuidv4 } from "uuid";
import { domainValidationError } from "@/lib/server/error";

/**
 * システム通知ID値オブジェクト
 * UUIDで一意に識別
 */
export class SystemNotificationId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 新規IDを生成する
   */
  static create(): SystemNotificationId {
    return new SystemNotificationId(uuidv4());
  }

  /**
   * 文字列からIDを復元する
   * @throws ドメインバリデーションエラー - 無効なUUID形式の場合
   */
  static reconstruct(value: string): SystemNotificationId {
    if (!uuidValidate(value)) {
      throw domainValidationError("SYSTEM_NOTIFICATION_ID_INVALID_FORMAT");
    }
    return new SystemNotificationId(value);
  }

  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: SystemNotificationId): boolean {
    return this._value === other._value;
  }
}
