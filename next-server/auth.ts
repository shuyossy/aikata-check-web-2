import { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import GitLabProvider from "next-auth/providers/gitlab";
import CredentialsProvider from "next-auth/providers/credentials";
import { SyncUserService, AuthenticateUserService } from "@/application/user";
import { UserRepository } from "@/infrastructure/adapter/db";
import { PasswordService } from "@/infrastructure/adapter/service";

/**
 * GitLabのプロファイル型定義
 */
interface GitLabProfile {
  id: number;
  username: string;
  name: string;
  email?: string;
  avatar_url?: string;
  web_url?: string;
}

/**
 * NextAuth設定オプション
 * Keycloak OIDC および GitLab OAuth2 プロバイダーを使用
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
          // 管理者フラグ（初期値、signInでDB値に更新される）
          isAdmin: false,
          // 標準属性
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    // GitLabプロバイダー（環境変数が設定されている場合のみ有効）
    ...(process.env.GITLAB_CLIENT_ID &&
    process.env.GITLAB_CLIENT_SECRET &&
    process.env.GITLAB_BASE_URL
      ? [
          GitLabProvider({
            clientId: process.env.GITLAB_CLIENT_ID,
            clientSecret: process.env.GITLAB_CLIENT_SECRET,
            // セルフホスト型GitLab対応
            authorization: {
              url: `${process.env.GITLAB_BASE_URL}/oauth/authorize`,
              params: { scope: "read_user" },
            },
            token: `${process.env.GITLAB_BASE_URL}/oauth/token`,
            userinfo: `${process.env.GITLAB_BASE_URL}/api/v4/user`,
            profile(profile: GitLabProfile) {
              return {
                id: String(profile.id),
                // GitLabのusernameを社員IDとして使用
                employeeId: profile.username,
                // GitLabのnameを表示名として使用
                displayName: profile.name || profile.username,
                // 管理者フラグ（初期値、signInでDB値に更新される）
                isAdmin: false,
                // 標準属性
                name: profile.name,
                email: profile.email,
                image: profile.avatar_url,
              };
            },
          }),
        ]
      : []),
    // 独自認証プロバイダー（社員ID + パスワード）
    CredentialsProvider({
      id: "credentials",
      name: "社員ID・パスワード",
      credentials: {
        employeeId: {
          label: "社員ID",
          type: "text",
          placeholder: "PIT*/A*",
        },
        password: {
          label: "パスワード",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.employeeId || !credentials?.password) {
          return null;
        }

        try {
          const authenticateUserService = new AuthenticateUserService(
            new UserRepository(),
            new PasswordService(),
          );
          const userDto = await authenticateUserService.execute({
            employeeId: credentials.employeeId,
            password: credentials.password,
          });

          // next-authが期待するユーザー形式で返却
          return {
            id: userDto.id,
            employeeId: userDto.employeeId,
            displayName: userDto.displayName,
            isAdmin: userDto.isAdmin,
            name: userDto.displayName,
            email: null,
            image: null,
          };
        } catch {
          // 認証失敗時はnullを返す
          return null;
        }
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
        token.id = user.id; // DBのユーザーID（UUID）
        token.employeeId = user.employeeId;
        token.displayName = user.displayName;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    /**
     * セッションにカスタム属性を追加
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string; // DBのユーザーID（UUID）
        session.user.employeeId = token.employeeId as string;
        session.user.displayName = token.displayName as string;
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
    /**
     * サインイン時にDBにユーザを同期
     */
    async signIn({ user, account }) {
      // 独自認証の場合は、authorize関数で既に認証済みなのでそのまま許可
      if (account?.provider === "credentials") {
        // userオブジェクトには既にDBのユーザー情報が設定されている
        return true;
      }

      // SSO認証の場合はDBにユーザを同期
      try {
        const syncUserService = new SyncUserService(new UserRepository());
        const syncedUser = await syncUserService.execute({
          employeeId: user.employeeId,
          displayName: user.displayName,
        });
        // DBのユーザーID（UUID）をuserオブジェクトに設定
        user.id = syncedUser.id;
        // 管理者フラグをDBから取得
        user.isAdmin = syncedUser.isAdmin;
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
