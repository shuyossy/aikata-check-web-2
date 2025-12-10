"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, AlertCircle, Frown, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>メンバーを検索</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="mb-4">
          <div className="relative flex gap-2">
            <div className="flex-1 relative">
              <Search className="size-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
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
                className="h-11 pl-10"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                handleSearch();
              }}
              disabled={!searchQuery.trim() || isSearching}
              className="h-11"
            >
              検索
            </Button>
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
              <Loader2 className="size-5 mr-2 animate-spin" />
              検索中...
            </div>
          ) : searchError ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-500">
              <AlertCircle className="size-12 mb-2" />
              <p className="text-sm">{searchError}</p>
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Search className="size-12 mb-2" />
              <p className="text-sm">氏名または社員IDで検索してください</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Frown className="size-12 mb-2" />
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                前へ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
              >
                次へ
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <DialogFooter className="mt-6 pt-4 border-t border-gray-200">
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleConfirm}>
            <Check className="size-5" />
            選択を確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
