"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Loader2, FolderOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/project";
import { listUserProjectsAction } from "../actions";
import { useAction } from "next-safe-action/hooks";
import { ProjectListItemDto } from "@/domain/project";
import { useServerActionError } from "@/hooks";
import { ListUserProjectsResult } from "@/application/project";

interface ProjectListClientProps {
  initialData: ListUserProjectsResult;
}

/**
 * プロジェクト一覧クライアントコンポーネント
 * 検索・ページネーション等のインタラクションを担当
 */
export function ProjectListClient({ initialData }: ProjectListClientProps) {
  const [projects, setProjects] = useState<ProjectListItemDto[]>(
    initialData.projects,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [totalCount, setTotalCount] = useState(initialData.total);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const { error, clearError, handleError } = useServerActionError();
  const limit = initialData.limit;

  const { execute: loadProjects, isPending: isLoading } = useAction(
    listUserProjectsAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setProjects(data.projects);
          setTotalCount(data.total);
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "プロジェクト一覧の取得に失敗しました。");
      },
    },
  );

  // 検索実行
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    loadProjects({
      search: searchQuery.trim() || undefined,
      page: 1,
      limit,
    });
  }, [searchQuery, loadProjects, limit]);

  // Enterキーで検索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // ページ変更
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadProjects({
      search: searchQuery.trim() || undefined,
      page,
      limit,
    });
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">プロジェクト</h2>
          <p className="text-gray-600">
            参加しているプロジェクトを選択してください
          </p>
        </div>

        {/* Search and Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1">
            <div className="relative flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11 pl-10"
                  placeholder="プロジェクトを検索..."
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSearch}
                disabled={isLoading}
                className="h-11"
              >
                検索
              </Button>
            </div>
          </div>

          {/* Create Button */}
          <Button asChild className="h-11">
            <Link href="/projects/new">
              <Plus className="size-5" />
              新規プロジェクト
            </Link>
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 text-blue-500 mr-3 animate-spin" />
            <span className="text-gray-600">読み込み中...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="mx-auto size-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              プロジェクトがありません
            </h3>
            <p className="mt-2 text-gray-600">
              {searchQuery
                ? "検索条件に一致するプロジェクトが見つかりませんでした"
                : "新規プロジェクトを作成して始めましょう"}
            </p>
          </div>
        ) : (
          <>
            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  {totalCount}件中 {(currentPage - 1) * limit + 1}-
                  {Math.min(currentPage * limit, totalCount)}件を表示
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                  >
                    前へ
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                  >
                    次へ
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
