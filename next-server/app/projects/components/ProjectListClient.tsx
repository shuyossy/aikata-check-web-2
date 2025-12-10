"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
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
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150"
                  placeholder="プロジェクトを検索..."
                />
                <svg
                  className="absolute left-3 top-3 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={isLoading}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition duration-150 font-medium disabled:opacity-50"
              >
                検索
              </button>
            </div>
          </div>

          {/* Create Button */}
          <Link
            href="/projects/new"
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-150 font-medium flex items-center gap-2 justify-center"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            新規プロジェクト
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <svg
              className="animate-spin h-8 w-8 text-blue-500 mr-3"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-600">読み込み中...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
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
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-50 transition duration-150"
                  >
                    前へ
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-50 transition duration-150"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
