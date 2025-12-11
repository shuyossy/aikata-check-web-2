"use client";

import { useRouter } from "next/navigation";
import { Clock, ChevronRight, Folder } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewSpaceListItemDto } from "@/domain/reviewSpace";
import { formatDate } from "@/lib/formatters";

interface ReviewSpaceCardProps {
  space: ReviewSpaceListItemDto;
  projectId: string;
}

/**
 * レビュースペースカードコンポーネント
 * レビュースペース一覧に表示されるカード
 */
export function ReviewSpaceCard({ space, projectId }: ReviewSpaceCardProps) {
  const router = useRouter();

  // カードクリック時のナビゲーション
  const handleCardClick = () => {
    router.push(`/projects/${projectId}/spaces/${space.id}`);
  };

  return (
    <Card
      onClick={handleCardClick}
      className="cursor-pointer py-0 hover:shadow-md hover:border-blue-300 transition duration-150 group"
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="size-5 text-blue-500" />
              <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-150 truncate">
                {space.name}
              </h4>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
              {space.description || "説明なし"}
            </p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="size-4 mr-2 text-gray-400" />
            最終更新: {formatDate(space.updatedAt)}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100">
          <span className="text-sm text-blue-600 font-medium group-hover:text-blue-700 flex items-center">
            開く
            <ChevronRight className="size-4 ml-1" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
