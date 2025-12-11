"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { ProjectListItemDto } from "@/domain/project";
import { formatDate } from "@/lib/formatters";

export interface ProjectCardProps {
  /** プロジェクト情報 */
  project: ProjectListItemDto;
}

/**
 * プロジェクトカードコンポーネント
 * プロジェクト一覧で表示されるカード
 */
export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  // メンバー名のリストを作成（AvatarGroup用）
  const memberNames = project.memberPreview.map(
    (member: { userId: string; displayName: string }) => ({
      name: member.displayName,
    }),
  );

  // カードクリック時のナビゲーション
  const handleCardClick = () => {
    router.push(`/projects/${project.id}/spaces`);
  };

  // 設定ボタンクリック時（イベント伝播を止めて設定ページへ）
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      onClick={handleCardClick}
      className="cursor-pointer py-0 hover:shadow-md hover:border-blue-300 transition duration-150 group"
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition duration-150 mb-1">
              {project.name}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            className="text-gray-400 hover:text-gray-600"
            title="設定"
          >
            <Link
              href={`/projects/${project.id}/settings`}
              onClick={handleSettingsClick}
            >
              <MoreVertical className="size-5" />
            </Link>
          </Button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
          {project.description || "説明なし"}
        </p>

        {/* Meta Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="size-4 mr-2 text-gray-400" />
            最終更新: {formatDate(project.updatedAt)}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <AvatarGroup members={memberNames} maxDisplay={3} size="md" />
          <span className="text-sm text-blue-600 font-medium group-hover:text-blue-700 flex items-center">
            開く
            <ChevronRight className="size-4 ml-1" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
