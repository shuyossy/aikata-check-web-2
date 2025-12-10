import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * NextAuthのUserインターフェースを拡張
   * Keycloakから取得する追加属性を定義
   */
  interface User {
    /** Keycloakのpreferred_username（社員ID） */
    employeeId: string;
    /** Keycloakのdisplay_name（表示名） */
    displayName: string;
  }

  /**
   * NextAuthのSessionインターフェースを拡張
   * セッションに含めるユーザ情報を定義
   */
  interface Session {
    user: {
      /** システム内部のユーザID */
      id?: string;
      /** Keycloakのpreferred_username（社員ID） */
      employeeId: string;
      /** Keycloakのdisplay_name（表示名） */
      displayName: string;
      /** メールアドレス（オプション） */
      email?: string | null;
      /** ユーザ名（オプション） */
      name?: string | null;
      /** プロフィール画像（オプション） */
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  /**
   * NextAuthのJWTインターフェースを拡張
   * JWTトークンに含める追加クレームを定義
   */
  interface JWT {
    /** Keycloakのpreferred_username（社員ID） */
    employeeId?: string;
    /** Keycloakのdisplay_name（表示名） */
    displayName?: string;
  }
}
