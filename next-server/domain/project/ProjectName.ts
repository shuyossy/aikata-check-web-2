import { domainValidationError } from "@/lib/server/error";

/**
 * プロジェクト名値オブジェクト
 * プロジェクトを識別するための名称（1-100文字）
 */
export class ProjectName {
  private static readonly MAX_LENGTH = 100;
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * 新規プロジェクト名を生成する
   * @throws ドメインバリデーションエラー - 名前が空または100文字超過の場合
   */
  static create(value: string): ProjectName {
    ProjectName.validate(value);
    return new ProjectName(value);
  }

  /**
   * 既存の文字列から復元する
   * DBからの復元時に使用（バリデーション済みのため検証なし）
   */
  static reconstruct(value: string): ProjectName {
    return new ProjectName(value);
  }

  /**
   * プロジェクト名の検証
   * @throws ドメインバリデーションエラー - 名前が不正な場合
   */
  private static validate(value: string): void {
    if (!value || !value.trim()) {
      throw domainValidationError("PROJECT_NAME_EMPTY");
    }

    if (value.length > ProjectName.MAX_LENGTH) {
      throw domainValidationError("PROJECT_NAME_TOO_LONG");
    }
  }

  /**
   * プロジェクト名を取得
   */
  get value(): string {
    return this._value;
  }

  /**
   * 等価性の比較
   */
  equals(other: ProjectName): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
