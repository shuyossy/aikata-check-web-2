import { getServerSession } from "next-auth";
import { IAuthUserPort, AuthUser } from "@/application/shared/port/auth";
import { authOptions } from "@/auth";

/**
 * NextAuth認証ユーザアダプター
 * IAuthUserPortの実装
 * NextAuthセッションから認証済みユーザ情報を取得
 */
export class NextAuthAdapter implements IAuthUserPort {
  /**
   * 現在の認証済みユーザを取得
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return null;
    }

    return {
      employeeId: session.user.employeeId,
      displayName: session.user.displayName,
    };
  }
}
