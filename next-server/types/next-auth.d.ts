import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * NextAuthのUserインターフェースを拡張
   * Keycloakから取得する追加属性を定義
   */
  interface User {
    /** DBのユーザーID（UUID） */
    id: string;
    /** Keycloakのpreferred_username（社員ID） */
    employeeId: string;
    /** Keycloakのdisplay_name（表示名） */
    displayName: string;
    /** 管理者フラグ */
    isAdmin: boolean;
  }

  /**
   * NextAuthのSessionインターフェースを拡張
   * セッションに含めるユーザ情報を定義
   */
  interface Session {
    user: {
      /** DBのユーザーID（UUID） */
      id: string;
      /** Keycloakのpreferred_username（社員ID） */
      employeeId: string;
      /** Keycloakのdisplay_name（表示名） */
      displayName: string;
      /** 管理者フラグ */
      isAdmin: boolean;
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
    /** DBのユーザーID（UUID） */
    id?: string;
    /** Keycloakのpreferred_username（社員ID） */
    employeeId?: string;
    /** Keycloakのdisplay_name（表示名） */
    displayName?: string;
    /** 管理者フラグ */
    isAdmin?: boolean;
  }
}
