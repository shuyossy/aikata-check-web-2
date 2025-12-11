"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error;
  reset: () => void;
}

/**
 * レビュースペース一覧ページのエラー状態
 */
export default function SpacesError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <AlertCircle className="size-16 text-red-500 mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        エラーが発生しました
      </h2>
      <p className="text-gray-600 mb-6 text-center max-w-md">
        {error.message || "ページの読み込み中にエラーが発生しました。"}
      </p>
      <Button onClick={reset}>再試行</Button>
    </div>
  );
}
