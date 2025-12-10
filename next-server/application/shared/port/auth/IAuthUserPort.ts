/**
 * 認証済みユーザ情報
 * NextAuthから取得するユーザ属性を抽象化
 */
export interface AuthUser {
  /** Keycloakのpreferred_username（社員ID） */
  employeeId: string;
  /** Keycloakのdisplay_name（表示名） */
  displayName: string;
}

/**
 * 認証ユーザ取得ポートインターフェース
 * インフラ層で実装される
 * 認証詳細がアプリケーション層より下に漏れないようにする
 */
export interface IAuthUserPort {
  /**
   * 現在の認証済みユーザを取得
   * @returns 認証済みユーザ情報（未認証の場合はnull）
   */
  getCurrentUser(): Promise<AuthUser | null>;
}
