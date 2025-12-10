import { domainValidationError } from "@/lib/server/error";

/** 社員IDの最大文字数 */
const MAX_LENGTH = 255;

/**
 * 社員ID値オブジェクト
 * Keycloakから取得するpreferred_usernameを保持
 */
export class EmployeeId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 文字列から社員IDを生成する
   * @throws ドメインバリデーションエラー - 社員IDが不正な場合
   */
  static create(value: string): EmployeeId {
    EmployeeId.validate(value);
    return new EmployeeId(value);
  }

  /**
   * 既存の文字列から復元する
   * @throws ドメインバリデーションエラー - 社員IDが不正な場合
   */
  static reconstruct(value: string): EmployeeId {
    EmployeeId.validate(value);
    return new EmployeeId(value);
  }

  /**
   * 社員IDの検証
   * @throws ドメインバリデーションエラー - 社員IDが不正な場合
   */
  private static validate(value: string): void {
    // nullまたはundefinedチェック
    if (value === null || value === undefined) {
      throw domainValidationError("EMPLOYEE_ID_EMPTY");
    }

    // 空文字または空白のみチェック
    if (!value.trim()) {
      throw domainValidationError("EMPLOYEE_ID_EMPTY");
    }

    // 長さチェック
    if (value.length > MAX_LENGTH) {
      throw domainValidationError("EMPLOYEE_ID_TOO_LONG");
    }
  }

  /**
   * 社員ID文字列を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: EmployeeId): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
