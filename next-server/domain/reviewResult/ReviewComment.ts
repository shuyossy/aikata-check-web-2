/**
 * レビューコメント値オブジェクト
 * AIによるレビューコメント（任意の長さ）
 */
export class ReviewComment {
  private readonly _value: string | null;

  private constructor(value: string | null) {
    this._value = value;
  }

  /**
   * 新規レビューコメントを生成する
   */
  static create(value: string | null): ReviewComment {
    return new ReviewComment(value);
  }

  /**
   * 既存のコメントから復元する
   * DBからの復元時に使用
   */
  static reconstruct(value: string | null): ReviewComment {
    return new ReviewComment(value);
  }

  /**
   * コメント値を取得
   */
  get value(): string | null {
    return this._value;
  }

  /**
   * コメントが設定されているかどうか
   */
  hasValue(): boolean {
    return this._value !== null && this._value.length > 0;
  }

  /**
   * 等価性の比較
   */
  equals(other: ReviewComment): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value ?? "";
  }
}
