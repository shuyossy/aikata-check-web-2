"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * プロジェクト一覧ページのエラーハンドリング
 */
export default function ProjectsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // エラーログ出力（必要に応じて外部サービスへの送信も可能）
    console.error("プロジェクト一覧の取得中にエラーが発生しました:", error);
  }, [error]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <svg
            className="h-16 w-16 text-red-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            エラーが発生しました
          </h2>
          <p className="text-gray-600 mb-6 text-center">
            プロジェクト一覧の取得中に問題が発生しました。
            <br />
            しばらくしてから再度お試しください。
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-150 font-medium"
          >
            再試行
          </button>
        </div>
      </main>
    </div>
  );
}
