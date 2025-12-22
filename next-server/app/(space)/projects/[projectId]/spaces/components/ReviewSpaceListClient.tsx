"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Loader2,
  Folder,
  AlertCircle,
  Settings,
  Key,
  KeySquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReviewSpaceCard } from "@/components/reviewSpace";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { listProjectReviewSpacesAction } from "../actions";
import { useAction } from "next-safe-action/hooks";
import { ReviewSpaceListItemDto } from "@/domain/reviewSpace";
import { ProjectDto } from "@/domain/project";
import { useServerActionError } from "@/hooks";
import { ListProjectReviewSpacesResult } from "@/application/reviewSpace";

interface ReviewSpaceListClientProps {
  projectId: string;
  project: ProjectDto;
  initialData: ListProjectReviewSpacesResult;
}

/**
 * レビュースペース一覧クライアントコンポーネント
 * 検索・ページネーション等のインタラクションを担当
 */
export function ReviewSpaceListClient({
  projectId,
  project,
  initialData,
}: ReviewSpaceListClientProps) {
  const [spaces, setSpaces] = useState<ReviewSpaceListItemDto[]>(
    initialData.spaces,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [totalCount, setTotalCount] = useState(initialData.total);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const { error, clearError, handleError } = useServerActionError();
  const limit = initialData.limit;

  const { execute: loadSpaces, isPending: isLoading } = useAction(
    listProjectReviewSpacesAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setSpaces(data.spaces);
          setTotalCount(data.total);
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "レビュースペース一覧の取得に失敗しました。");
      },
    },
  );

  // 検索実行
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    loadSpaces({
      projectId,
      search: searchQuery.trim() || undefined,
      page: 1,
      limit,
    });
  }, [projectId, searchQuery, loadSpaces, limit]);

  // Enterキーで検索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // ページ変更
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadSpaces({
      projectId,
      search: searchQuery.trim() || undefined,
      page,
      limit,
    });
  };

  const totalPages = Math.ceil(totalCount / limit);

  // メンバー名のリスト（AvatarGroup用）
  const memberList = project.members.map((m) => ({
    name: m.displayName || `ユーザー${m.userId.slice(0, 4)}`,
  }));

  return (
    <div className="space-y-6">
      {/* パンくずリスト */}
      <Breadcrumb items={[{ label: project.name }]} />

      {/* プロジェクト設定セクション */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              プロジェクト設定
            </h3>
            <Link
              href={`/projects/${projectId}/settings`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Settings className="size-4" />
              設定
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* プロジェクト名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プロジェクト名
              </label>
              <p className="text-sm text-gray-900">{project.name}</p>
            </div>

            {/* APIキー */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                APIキー
              </label>
              <div className="flex items-center gap-2">
                {project.hasApiKey ? (
                  <>
                    <Key className="size-5 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">
                      設定済み
                    </p>
                  </>
                ) : (
                  <>
                    <KeySquare className="size-5 text-gray-400" />
                    <p className="text-sm text-gray-500">未設定</p>
                  </>
                )}
              </div>
            </div>

            {/* 説明 */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明
              </label>
              <p className="text-sm text-gray-600">
                {project.description || "説明なし"}
              </p>
            </div>

            {/* メンバー */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メンバー
              </label>
              <AvatarGroup members={memberList} maxDisplay={5} />
            </div>
          </div>
        </div>
      </div>

      {/* アクションバー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">
            レビュースペース一覧
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            レビュースペースを選択してレビューを開始します
          </p>
        </div>
        <Button asChild>
          <Link href={`/projects/${projectId}/spaces/new`}>
            <Plus className="size-5" />
            新規スペース
          </Link>
        </Button>
      </div>

      {/* 検索バー */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-11 pl-10"
            placeholder="レビュースペースを検索..."
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

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* コンテンツ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 text-blue-500 mr-3 animate-spin" />
          <span className="text-gray-600">読み込み中...</span>
        </div>
      ) : spaces.length === 0 ? (
        <div className="text-center py-16">
          <Folder className="mx-auto size-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            レビュースペースがありません
          </h3>
          <p className="mt-2 text-gray-600">
            {searchQuery
              ? "検索条件に一致するレビュースペースが見つかりませんでした"
              : "新規スペースを作成して始めましょう"}
          </p>
        </div>
      ) : (
        <>
          {/* スペースグリッド */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => (
              <ReviewSpaceCard
                key={space.id}
                space={space}
                projectId={projectId}
              />
            ))}
          </div>

          {/* ページネーション */}
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
    </div>
  );
}
