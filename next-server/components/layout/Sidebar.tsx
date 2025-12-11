"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Folder,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProjectSwitcher } from "@/components/project/ProjectSwitcher";
import { ProjectListItemDto } from "@/domain/project";
import { ReviewSpaceListItemDto } from "@/domain/reviewSpace";

interface SidebarProps {
  currentProject: ProjectListItemDto;
  projects: ProjectListItemDto[];
  reviewSpaces: ReviewSpaceListItemDto[];
}

/**
 * サイドバーコンポーネント
 * プロジェクトスイッチャーとレビュースペースのナビゲーションを含む
 */
export function Sidebar({
  currentProject,
  projects,
  reviewSpaces,
}: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* モバイルメニューボタン */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {/* オーバーレイ（モバイル） */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 md:translate-x-0 md:static",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex-1 overflow-y-auto p-4">
          {/* ロゴ */}
          <Link href="/projects" className="block mb-6">
            <h1 className="text-xl font-bold text-blue-600">AIKATA</h1>
          </Link>

          {/* プロジェクトスイッチャー */}
          <ProjectSwitcher
            currentProject={currentProject}
            projects={projects}
            className="mb-6"
          />

          {/* レビュースペースセクション */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              レビュースペース
            </h3>
            <nav className="space-y-1">
              {reviewSpaces.length > 0 ? (
                reviewSpaces.map((space) => {
                  const isActive = pathname.includes(
                    `/projects/${currentProject.id}/spaces/${space.id}`,
                  );
                  return (
                    <Link
                      key={space.id}
                      href={`/projects/${currentProject.id}/spaces/${space.id}`}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150",
                        isActive
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-700 hover:bg-gray-100",
                      )}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          !isActive && "-rotate-90",
                        )}
                      />
                      <Folder className="size-4" />
                      <span className="truncate">{space.name}</span>
                    </Link>
                  );
                })
              ) : (
                <p className="px-3 py-2 text-sm text-gray-500">
                  レビュースペースがありません
                </p>
              )}
            </nav>
          </div>
        </div>
      </aside>
    </>
  );
}
