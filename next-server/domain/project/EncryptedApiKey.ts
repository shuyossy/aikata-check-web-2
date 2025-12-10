import { encrypt, decrypt } from "@/lib/server/encryption";

/**
 * 暗号化APIキー値オブジェクト
 * AES-256で暗号化されたAPIキー（任意）
 */
export class EncryptedApiKey {
  private readonly _encryptedValue: string | null;

  private constructor(encryptedValue: string | null) {
    this._encryptedValue = encryptedValue;
  }

  /**
   * 平文のAPIキーから暗号化して生成する
   * @param plainText - 平文のAPIキー（null/undefined/空文字の場合はnullとして扱う）
   */
  static fromPlainText(plainText: string | null | undefined): EncryptedApiKey {
    if (!plainText || !plainText.trim()) {
      return new EncryptedApiKey(null);
    }
    const encrypted = encrypt(plainText);
    return new EncryptedApiKey(encrypted);
  }

  /**
   * 暗号化済みの文字列から復元する
   * DBからの復元時に使用
   */
  static reconstruct(encryptedValue: string | null): EncryptedApiKey {
    return new EncryptedApiKey(encryptedValue);
  }

  /**
   * 暗号化された値を取得（DB保存用）
   */
  get encryptedValue(): string | null {
    return this._encryptedValue;
  }

  /**
   * 値が設定されているか確認
   */
  hasValue(): boolean {
    return this._encryptedValue !== null;
  }

  /**
   * 復号化して平文のAPIキーを取得する
   * @returns 平文のAPIキー（値がない場合はnull）
   */
  decrypt(): string | null {
    if (!this._encryptedValue) {
      return null;
    }
    return decrypt(this._encryptedValue);
  }

  /**
   * 等価性の比較（暗号化された値で比較）
   */
  equals(other: EncryptedApiKey): boolean {
    return this._encryptedValue === other._encryptedValue;
  }
}
