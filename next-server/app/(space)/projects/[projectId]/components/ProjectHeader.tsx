"use client";

import { UserMenu } from "@/components/layout/UserMenu";

interface ProjectHeaderProps {
  projectName: string;
}

/**
 * プロジェクトページのヘッダーコンポーネント
 * プロジェクト名とユーザーメニューを表示
 */
export function ProjectHeader({ projectName }: ProjectHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{projectName}</h2>
        <UserMenu />
      </div>
    </header>
  );
}
