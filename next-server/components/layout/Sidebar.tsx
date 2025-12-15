"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Folder,
  Menu,
  X,
  ClipboardList,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProjectSwitcher } from "@/components/project/ProjectSwitcher";
import { ProjectListItemDto } from "@/domain/project";

/**
 * サイドバーで表示するレビュー対象の型
 */
interface ReviewTargetSidebarItem {
  id: string;
  name: string;
  status: "pending" | "queued" | "reviewing" | "completed" | "error";
}

/**
 * サイドバーで表示するレビュースペースの型
 */
interface ReviewSpaceSidebarItem {
  id: string;
  name: string;
  reviewTargets: ReviewTargetSidebarItem[];
  hasMore: boolean;
}

interface SidebarProps {
  currentProject: ProjectListItemDto;
  projects: ProjectListItemDto[];
  reviewSpaces: ReviewSpaceSidebarItem[];
}

/**
 * レビュー対象のステータスに応じたアイコンを取得
 */
function getStatusIcon(status: ReviewTargetSidebarItem["status"]) {
  switch (status) {
    case "reviewing":
      return <Loader2 className="size-3 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle className="size-3 text-green-500" />;
    case "error":
      return <AlertCircle className="size-3 text-red-500" />;
    case "pending":
      return <Clock className="size-3 text-gray-400" />;
    case "queued":
      return <Clock className="size-3 text-yellow-500" />;
    default:
      return <FileText className="size-3 text-gray-400" />;
  }
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
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 展開中のスペースIDを管理
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(() => {
    // 現在のパスに含まれるスペースIDを初期展開
    const initialExpanded = new Set<string>();
    reviewSpaces.forEach((space) => {
      if (
        pathname.includes(`/projects/${currentProject.id}/spaces/${space.id}`)
      ) {
        initialExpanded.add(space.id);
      }
    });
    return initialExpanded;
  });

  // スペースの展開/折りたたみをトグル
  const toggleSpace = useCallback((spaceId: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) {
        next.delete(spaceId);
      } else {
        next.add(spaceId);
      }
      return next;
    });
  }, []);

  // スペース名クリック時の処理（展開しながらレビュー対象一覧へ遷移）
  const handleSpaceClick = useCallback(
    (spaceId: string, e: React.MouseEvent) => {
      // Chevronアイコン以外がクリックされた場合は遷移
      const target = e.target as HTMLElement;
      const isChevronClick =
        target.closest('[data-chevron="true"]') !== null;

      if (!isChevronClick) {
        // 展開状態にして遷移
        setExpandedSpaces((prev) => {
          const next = new Set(prev);
          next.add(spaceId);
          return next;
        });
        router.push(`/projects/${currentProject.id}/spaces/${spaceId}`);
      }
    },
    [currentProject.id, router],
  );

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
                  const isExpanded = expandedSpaces.has(space.id);

                  return (
                    <div key={space.id} className="space-y-1">
                      {/* スペースボタン */}
                      <button
                        onClick={(e) => handleSpaceClick(space.id, e)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150",
                          isActive
                            ? "text-blue-600 bg-blue-50"
                            : "text-gray-700 hover:bg-gray-100",
                        )}
                      >
                        <ChevronDown
                          data-chevron="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSpace(space.id);
                          }}
                          className={cn(
                            "size-4 transition-transform cursor-pointer hover:text-blue-600",
                            !isExpanded && "-rotate-90",
                          )}
                        />
                        <Folder className="size-4" />
                        <span className="truncate">{space.name}</span>
                      </button>

                      {/* 展開時の子要素 */}
                      {isExpanded && (
                        <div className="ml-6 space-y-1 border-l-2 border-gray-200 pl-2">
                          {/* チェックリストリンク */}
                          <Link
                            href={`/projects/${currentProject.id}/spaces/${space.id}/checklist`}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 text-sm rounded transition duration-150",
                              pathname.includes(
                                `/spaces/${space.id}/checklist`,
                              )
                                ? "text-blue-600 bg-blue-50"
                                : "text-gray-700 hover:bg-gray-100",
                            )}
                          >
                            <ClipboardList className="size-3" />
                            <span className="truncate">チェックリスト</span>
                          </Link>

                          {/* レビュー対象リスト */}
                          {space.reviewTargets.map((target) => {
                            const isTargetActive = pathname.includes(
                              `/review/${target.id}`,
                            );
                            return (
                              <Link
                                key={target.id}
                                href={`/projects/${currentProject.id}/spaces/${space.id}/review/${target.id}`}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 text-sm rounded transition duration-150",
                                  isTargetActive
                                    ? "text-blue-600 bg-blue-50"
                                    : "text-gray-700 hover:bg-gray-100",
                                )}
                              >
                                {getStatusIcon(target.status)}
                                <span className="truncate">{target.name}</span>
                              </Link>
                            );
                          })}

                          {/* もっと見るリンク */}
                          {space.hasMore && (
                            <Link
                              href={`/projects/${currentProject.id}/spaces/${space.id}`}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 transition"
                            >
                              <span>もっと見る...</span>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
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
