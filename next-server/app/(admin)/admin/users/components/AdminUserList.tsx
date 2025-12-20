"use client";

import { UserDto } from "@/domain/user";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/button";
import { UserMinus } from "lucide-react";

interface AdminUserListProps {
  admins: UserDto[];
  currentUserId: string;
  onRevokeAdmin: (userId: string) => void;
  isRevoking: boolean;
}

/**
 * 管理者一覧コンポーネント
 */
export function AdminUserList({
  admins,
  currentUserId,
  onRevokeAdmin,
  isRevoking,
}: AdminUserListProps) {
  if (admins.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        管理者が登録されていません
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {admins.map((admin) => {
        const isCurrentUser = admin.id === currentUserId;
        const isLastAdmin = admins.length === 1;
        const canRevoke = !isCurrentUser && !isLastAdmin;

        return (
          <div
            key={admin.id}
            className="flex items-center justify-between py-4 px-2"
          >
            <div className="flex items-center gap-3">
              <Avatar name={admin.displayName} size="md" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {admin.displayName}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-gray-500">(自分)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">ID: {admin.employeeId}</p>
              </div>
            </div>
            <div>
              {canRevoke ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRevokeAdmin(admin.id)}
                  disabled={isRevoking}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <UserMinus className="size-4 mr-1" />
                  権限削除
                </Button>
              ) : isCurrentUser ? (
                <span className="text-xs text-gray-400">
                  自分の権限は削除できません
                </span>
              ) : isLastAdmin ? (
                <span className="text-xs text-gray-400">
                  最後の管理者は削除できません
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
