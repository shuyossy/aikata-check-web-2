import { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { SyncUserService } from "@/application/user";
import { UserRepository } from "@/infrastructure/adapter/db";

/**
 * NextAuth設定オプション
 * Keycloak OIDCプロバイダーを使用
 */
export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      profile(profile) {
        return {
          id: profile.sub,
          // Keycloakから取得するカスタム属性
          employeeId: profile.preferred_username,
          displayName:
            profile.display_name || profile.name || profile.preferred_username,
          // 標準属性
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24時間
  },
  callbacks: {
    /**
     * JWTトークンにカスタム属性を追加
     */
    async jwt({ token, user, account }) {
      // 初回サインイン時のみuserが存在
      if (account && user) {
        token.employeeId = user.employeeId;
        token.displayName = user.displayName;
      }
      return token;
    },
    /**
     * セッションにカスタム属性を追加
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.employeeId = token.employeeId as string;
        session.user.displayName = token.displayName as string;
      }
      return session;
    },
    /**
     * サインイン時にDBにユーザを同期
     */
    async signIn({ user }) {
      try {
        const syncUserService = new SyncUserService(new UserRepository());
        await syncUserService.execute({
          employeeId: user.employeeId,
          displayName: user.displayName,
        });
        return true;
      } catch (error) {
        console.error("Failed to sync user:", error);
        // DB処理に失敗した場合はサインインを拒否
        // このシステムはユーザが識別されることを前提としているため
        return "/api/auth/error?error=UserSyncFailed";
      }
    },
  },
  pages: {
    signIn: "/auth/signin", // カスタムサインインページ
    error: "/auth/signin", // エラー時もサインインページに（エラーパラメータ付き）
  },
};
