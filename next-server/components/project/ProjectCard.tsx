"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { ProjectListItemDto } from "@/domain/project";

export interface ProjectCardProps {
  /** プロジェクト情報 */
  project: ProjectListItemDto;
}

/**
 * 日付をフォーマット（YYYY/MM/DD形式）
 * UTCベースでフォーマットしてサーバー/クライアント間の一貫性を保証
 */
function formatDate(dateString: string | Date): string {
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
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
    router.push(`/projects/${project.id}/review-spaces`);
  };

  // 設定ボタンクリック時（イベント伝播を止めて設定ページへ）
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition duration-150 cursor-pointer group"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition duration-150 mb-1">
              {project.name}
            </h3>
          </div>
          <Link
            href={`/projects/${project.id}/settings`}
            onClick={handleSettingsClick}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="設定"
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
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </Link>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
          {project.description || "説明なし"}
        </p>

        {/* Meta Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-500">
            <svg
              className="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            最終更新: {formatDate(project.updatedAt)}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <AvatarGroup members={memberNames} maxDisplay={3} size="md" />
          <span className="text-sm text-blue-600 font-medium group-hover:text-blue-700 flex items-center">
            開く
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
