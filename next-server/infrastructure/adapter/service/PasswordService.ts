import { timingSafeEqual } from "crypto";
import { encrypt, decrypt } from "@/lib/server/encryption";
import { IPasswordService } from "@/application/shared/port/service";

/**
 * パスワードサービス実装
 * AES-256-GCM暗号化を使用してパスワードを暗号化・検証する
 */
export class PasswordService implements IPasswordService {
  /**
   * 平文パスワードを暗号化する
   * @param plainPassword - 暗号化する平文パスワード
   * @returns AES-256-GCMで暗号化されたパスワード（Base64エンコード）
   */
  encrypt(plainPassword: string): string {
    return encrypt(plainPassword);
  }

  /**
   * パスワードを検証する
   * タイミング攻撃対策のためtimingSafeEqualを使用
   * @param plainPassword - 検証する平文パスワード
   * @param encryptedPassword - 暗号化されたパスワード
   * @returns パスワードが一致する場合はtrue
   */
  verify(plainPassword: string, encryptedPassword: string): boolean {
    try {
      const decrypted = decrypt(encryptedPassword);
      const decryptedBuffer = Buffer.from(decrypted, "utf8");
      const plainBuffer = Buffer.from(plainPassword, "utf8");

      // 長さが異なる場合は一致しない
      if (decryptedBuffer.length !== plainBuffer.length) {
        return false;
      }

      return timingSafeEqual(decryptedBuffer, plainBuffer);
    } catch {
      // 復号に失敗した場合はfalseを返す
      return false;
    }
  }
}
