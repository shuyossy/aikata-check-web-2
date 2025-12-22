import { domainValidationError } from "@/lib/server/error";

/**
 * パスワード値オブジェクト
 * 平文パスワードを表現する値オブジェクト
 */
export class Password {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * パスワードを作成する
   * @throws ドメインバリデーションエラー - パスワードが空の場合
   */
  static create(password: string): Password {
    Password.validate(password);
    return new Password(password);
  }

  /**
   * パスワードのバリデーション
   * @throws ドメインバリデーションエラー - パスワードが空の場合
   */
  private static validate(password: string): void {
    if (!password || !password.trim()) {
      throw domainValidationError("PASSWORD_EMPTY");
    }
  }

  /**
   * パスワードの値を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 他のPasswordと等しいかどうかを判定
   */
  equals(other: Password): boolean {
    return this._value === other._value;
  }
}
