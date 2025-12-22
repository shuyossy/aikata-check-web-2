/**
 * パスワードサービスインターフェース
 * パスワードの暗号化と検証を行う
 */
export interface IPasswordService {
  /**
   * 平文パスワードを暗号化する
   * @param plainPassword - 暗号化する平文パスワード
   * @returns 暗号化されたパスワード
   */
  encrypt(plainPassword: string): string;

  /**
   * パスワードを検証する
   * @param plainPassword - 検証する平文パスワード
   * @param encryptedPassword - 暗号化されたパスワード
   * @returns パスワードが一致する場合はtrue
   */
  verify(plainPassword: string, encryptedPassword: string): boolean;
}
