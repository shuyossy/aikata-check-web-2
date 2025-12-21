import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";

/**
 * 認証済みユーザ情報（RSC用）
 * セッションから直接取得可能な情報のみ
 */
export interface AuthenticatedUser {
  /** DBのユーザーID（UUID） */
  userId: string;
  /** Keycloakの社員ID */
  employeeId: string;
  /** 表示名 */
  displayName: string;
  /** 管理者フラグ */
  isAdmin: boolean;
}

/**
 * RSCで認証済みユーザ情報を取得する
 * 未認証の場合はサインインページにリダイレクトする
 *
 * @returns 認証済みユーザ情報
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session?.user?.employeeId) {
    redirect("/auth/signin");
  }

  return {
    userId: session.user.id,
    employeeId: session.user.employeeId,
    displayName: session.user.displayName,
    isAdmin: session.user.isAdmin ?? false,
  };
}
