"use client";

import { useState, useEffect, useCallback } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { UserDto } from "@/domain/user";
import { searchUsersAction } from "@/app/projects/actions";
import { useAction } from "next-safe-action/hooks";

export interface MemberSearchModalProps {
  /** モーダルが開いているかどうか */
  isOpen: boolean;
  /** モーダルを閉じるハンドラ */
  onClose: () => void;
  /** 選択確定ハンドラ */
  onConfirm: (selectedUsers: UserDto[]) => void;
  /** 初期選択済みユーザー */
  initialSelected?: UserDto[];
  /** 除外するユーザーID（自分自身など） */
  excludeUserIds?: string[];
}

/**
 * メンバー検索モーダルコンポーネント
 * ユーザーを検索して選択する
 */
export function MemberSearchModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelected = [],
  excludeUserIds = [],
}: MemberSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserDto[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, UserDto>>(
    new Map(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const limit = 10;

  const { execute: searchUsers, isPending: isSearching } = useAction(
    searchUsersAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          // 除外ユーザーをフィルタリング
          const filteredUsers = data.users.filter(
            (u) => !excludeUserIds.includes(u.id),
          );
          setSearchResults(filteredUsers);
          setTotalCount(data.total - excludeUserIds.length);
          setHasSearched(true);
          setSearchError(null);
        }
      },
      onError: ({ error: actionError }) => {
        setHasSearched(true);
        // サーバからのエラーメッセージを取得（存在すればそれを使用、なければ汎用メッセージ）
        const serverMessage =
          typeof actionError.serverError === "object" &&
          actionError.serverError !== null &&
          "message" in actionError.serverError
            ? (actionError.serverError as { message: string }).message
            : null;
        setSearchError(serverMessage || "ユーザー検索に失敗しました。");
      },
    },
  );

  // 初期選択をセット
  useEffect(() => {
    if (isOpen) {
      const map = new Map<string, UserDto>();
      initialSelected.forEach((user) => {
        if (!excludeUserIds.includes(user.id)) {
          map.set(user.id, user);
        }
      });
      setSelectedUsers(map);
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);
      setCurrentPage(1);
      setSearchError(null);
    }
  }, [isOpen, initialSelected, excludeUserIds]);

  // 検索実行
  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      searchUsers({ query: searchQuery.trim(), page: currentPage, limit });
    }
  }, [searchQuery, currentPage, searchUsers]);

  // Enterキーで検索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setCurrentPage(1);
      handleSearch();
    }
  };

  // ページ変更時に検索
  useEffect(() => {
    if (hasSearched && searchQuery.trim()) {
      searchUsers({ query: searchQuery.trim(), page: currentPage, limit });
    }
  }, [currentPage, hasSearched, searchQuery, searchUsers]);

  // ユーザー選択トグル
  const toggleUser = (user: UserDto) => {
    const newSelected = new Map(selectedUsers);
    if (newSelected.has(user.id)) {
      newSelected.delete(user.id);
    } else {
      newSelected.set(user.id, user);
    }
    setSelectedUsers(newSelected);
  };

  // 確定
  const handleConfirm = () => {
    onConfirm(Array.from(selectedUsers.values()));
    onClose();
  };

  if (!isOpen) return null;

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              メンバーを検索
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition duration-150"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <div className="relative flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="search"
                  placeholder="氏名または社員IDで検索..."
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(value);
                    // 検索ボックスが空になったら検索結果をクリア
                    if (!value.trim()) {
                      setSearchResults([]);
                      setHasSearched(false);
                      setCurrentPage(1);
                      setTotalCount(0);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150"
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
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
                onClick={() => {
                  setCurrentPage(1);
                  handleSearch();
                }}
                disabled={!searchQuery.trim() || isSearching}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 font-medium"
              >
                検索
              </button>
            </div>
          </div>

          {/* Selected Count */}
          <div className="mb-3">
            <p className="text-sm text-gray-600">
              選択中:{" "}
              <span className="font-medium text-gray-900">
                {selectedUsers.size}名
              </span>
            </p>
          </div>

          {/* User List */}
          <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[200px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <svg
                  className="animate-spin h-5 w-5 mr-2"
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
                検索中...
              </div>
            ) : searchError ? (
              <div className="flex flex-col items-center justify-center py-8 text-red-500">
                <svg
                  className="w-12 h-12 mb-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm">{searchError}</p>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <svg
                  className="w-12 h-12 mb-2"
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
                <p className="text-sm">氏名または社員IDで検索してください</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <svg
                  className="w-12 h-12 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">該当するユーザーが見つかりません</p>
              </div>
            ) : (
              searchResults.map((user) => {
                const isSelected = selectedUsers.has(user.id);
                return (
                  <label
                    key={user.id}
                    className={`flex items-center gap-3 p-3 bg-white rounded-lg border cursor-pointer transition duration-150 ${
                      isSelected
                        ? "border-blue-300 hover:border-blue-400"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(user)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Avatar name={user.displayName} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-gray-500">
                        ID: {user.employeeId}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {hasSearched && totalCount > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                {totalCount}件中 {(currentPage - 1) * limit + 1}-
                {Math.min(currentPage * limit, totalCount)}件を表示
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-50 transition duration-150"
                >
                  前へ
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-50 transition duration-150"
                >
                  次へ
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-150 font-medium text-center"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-150 font-medium flex items-center justify-center gap-2"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              選択を確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
