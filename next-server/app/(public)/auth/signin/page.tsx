"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * サインインページコンテンツ
 * useSearchParamsを使用するためSuspenseでラップが必要
 */
function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

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
                : "ログインに失敗しました"}
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}

/**
 * サインインページ
 * Keycloak OIDCへのリダイレクト用ログインページ
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
