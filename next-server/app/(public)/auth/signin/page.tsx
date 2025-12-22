"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

/**
 * サインインページコンテンツ
 * useSearchParamsを使用するためSuspenseでラップが必要
 */
function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  /**
   * 独自認証でのサインイン処理
   */
  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setCredentialsError(null);

    try {
      const result = await signIn("credentials", {
        employeeId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setCredentialsError("社員IDまたはパスワードが正しくありません");
      } else if (result?.ok) {
        router.push(callbackUrl);
      }
    } catch {
      setCredentialsError("ログイン処理中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-700 mb-2">AIKATA</h1>
          <p className="text-gray-600">AIレビュープラットフォーム</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ログイン</h2>
            <p className="text-sm text-gray-600">
              アカウントにログインしてください
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error === "UserSyncFailed"
                ? "システムに問題が発生しており、ログイン処理を完了できません"
                : error === "CredentialsSignin"
                  ? "社員IDまたはパスワードが正しくありません"
                  : "ログインに失敗しました"}
            </div>
          )}

          {credentialsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {credentialsError}
            </div>
          )}

          {/* Credentials Login Form */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">社員ID</Label>
              <Input
                id="employeeId"
                type="text"
                placeholder="PIT*/A*"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !employeeId || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ログイン中...
                </>
              ) : (
                "ログイン"
              )}
            </Button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-600">
              アカウントをお持ちでない方は{" "}
              <Link
                href="/auth/signup"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                新規登録
              </Link>
            </span>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                シングルサインオン
              </span>
            </div>
          </div>

          {/* SSO Options */}
          <div className="space-y-3">
            <button
              onClick={() => signIn("keycloak", { callbackUrl })}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 font-medium flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Keycloakでログイン
            </button>

            <button
              onClick={() => signIn("gitlab", { callbackUrl })}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition duration-150 font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 00-.867 0L1.386 9.452.044 13.587a.924.924 0 00.331 1.023L12 23.054l11.625-8.443a.92.92 0 00.33-1.024" />
              </svg>
              GitLabでログイン
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * サインインページ
 * 独自認証（社員ID・パスワード）およびKeycloak OIDC / GitLab OAuth2へのリダイレクト
 */
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
