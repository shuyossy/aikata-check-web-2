"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { signupAction } from "./actions/signupAction";
import { showError, showSuccess } from "@/lib/client/toast";
import { getMessage } from "@/lib/client/messages";

/**
 * サインアップページ
 * 独自認証用のユーザ登録画面
 */
export default function SignUpPage() {
  const router = useRouter();

  const [employeeId, setEmployeeId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { execute: executeSignup, isPending: isLoading } = useAction(
    signupAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          showSuccess(getMessage(data.messageCode));
          router.push("/auth/signin");
        }
      },
      onError: ({ error }) => {
        if (error.serverError) {
          const serverError = error.serverError as { message?: string };
          showError(serverError.message || "登録に失敗しました");
        } else {
          showError("登録に失敗しました");
        }
      },
    },
  );

  /**
   * サインアップ処理
   */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // パスワード確認
    if (password !== confirmPassword) {
      setValidationError("パスワードが一致しません");
      return;
    }

    executeSignup({
      employeeId,
      displayName,
      password,
    });
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-700 mb-2">AIKATA</h1>
          <p className="text-gray-600">AIレビュープラットフォーム</p>
        </div>

        {/* Signup Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              アカウント登録
            </h2>
            <p className="text-sm text-gray-600">
              新規アカウントを作成してください
            </p>
          </div>

          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {validationError}
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
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
              <Label htmlFor="displayName">名前</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="山田太郎"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード（確認）</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                !employeeId ||
                !displayName ||
                !password ||
                !confirmPassword
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登録中...
                </>
              ) : (
                "登録"
              )}
            </Button>
          </form>

          {/* Sign In Link */}
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-600">
              既にアカウントをお持ちの方は{" "}
              <Link
                href="/auth/signin"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                ログイン
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
