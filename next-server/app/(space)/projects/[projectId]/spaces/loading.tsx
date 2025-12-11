import { Loader2 } from "lucide-react";

/**
 * レビュースペース一覧ページのローディング状態
 */
export default function SpacesLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="size-8 text-blue-500 animate-spin" />
      <span className="ml-3 text-gray-600">読み込み中...</span>
    </div>
  );
}
