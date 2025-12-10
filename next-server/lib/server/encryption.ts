import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 暗号化キーを取得する
 * 環境変数から32バイト（256ビット）のキーを取得
 * @throws Error - 暗号化キーが設定されていない場合
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // 32バイト（256ビット）のキーを期待
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256",
    );
  }

  return keyBuffer;
}

/**
 * 平文を暗号化する
 * AES-256-GCM方式で暗号化し、IV + 認証タグ + 暗号文をBase64エンコードして返す
 * @param plainText - 暗号化する平文
 * @returns Base64エンコードされた暗号化データ
 */
export function encrypt(plainText: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // IV + AuthTag + EncryptedData を結合してBase64エンコード
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  return combined.toString("base64");
}

/**
 * 暗号化データを復号する
 * @param encryptedData - Base64エンコードされた暗号化データ
 * @returns 復号された平文
 * @throws Error - 復号に失敗した場合
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "base64");

  // データを分解
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
