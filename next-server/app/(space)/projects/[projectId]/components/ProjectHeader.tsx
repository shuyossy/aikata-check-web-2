"use client";

import { UserMenu } from "@/components/layout/UserMenu";
import { AdminLink } from "@/components/layout/AdminLink";

interface ProjectHeaderProps {
  projectName: string;
}

/**
 * プロジェクトページのヘッダーコンポーネント
 * プロジェクト名とユーザーメニューを表示
 */
export function ProjectHeader({ projectName }: ProjectHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{projectName}</h2>
        <div className="flex items-center gap-3">
          <AdminLink />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
