"use client";

import { useState, useEffect, useCallback } from "react";
import { UserDto } from "@/domain/user";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { listAllUsersAction } from "../actions";
import { useServerActionError } from "@/hooks";

interface AdminUserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAdminIds: string[];
  onGrantAdmin: (userId: string) => void;
  isGranting: boolean;
}

/**
 * ユーザー検索ダイアログ（管理者権限付与用）
 */
export function AdminUserSearchDialog({
  open,
  onOpenChange,
  existingAdminIds,
  onGrantAdmin,
  isGranting,
}: AdminUserSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { error, handleError, clearError } = useServerActionError();

  const { execute: searchUsers, isPending: isSearching } = useAction(
    listAllUsersAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setUsers(data.users);
          setTotalCount(data.totalCount);
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "ユーザー検索に失敗しました");
      },
    },
  );

  // debounced search
  const doSearch = useCallback(() => {
    searchUsers({
      page: 1,
      limit: 20,
      search: searchQuery || undefined,
    });
  }, [searchQuery, searchUsers]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        doSearch();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, searchQuery, doSearch]);

  // ダイアログが閉じたらリセット
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setUsers([]);
    }
  }, [open]);

  const filteredUsers = users.filter(
    (user) => !existingAdminIds.includes(user.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>管理者権限の付与</DialogTitle>
          <DialogDescription>
            管理者権限を付与するユーザーを検索して選択してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 検索フィールド */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              type="text"
              placeholder="名前または社員IDで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ユーザー一覧 */}
          <div className="max-h-64 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-gray-400" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {users.length > 0
                  ? "すべてのユーザーが既に管理者です"
                  : "ユーザーが見つかりません"}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={user.displayName} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {user.employeeId}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGrantAdmin(user.id)}
                      disabled={isGranting}
                    >
                      <UserPlus className="size-4 mr-1" />
                      付与
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 検索結果件数 */}
          {totalCount > 0 && (
            <p className="text-xs text-gray-500 text-center">
              {totalCount}件中 {filteredUsers.length}件を表示
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
