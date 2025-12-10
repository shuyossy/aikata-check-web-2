"use client";

import { Avatar } from "@/components/ui/Avatar";
import { UserDto } from "@/domain/user";

export interface MemberListProps {
  /** メンバーリスト */
  members: UserDto[];
  /** 現在のユーザーID */
  currentUserId: string;
  /** メンバー削除ハンドラ */
  onRemove?: (userId: string) => void;
  /** 読み取り専用モード */
  readOnly?: boolean;
}

/**
 * メンバー一覧コンポーネント
 * 選択されたプロジェクトメンバーを表示
 */
export function MemberList({
  members,
  currentUserId,
  onRemove,
  readOnly = false,
}: MemberListProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">
        選択済みメンバー ({members.length}名)
      </p>

      {members.map((member) => {
        const isSelf = member.id === currentUserId;
        return (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <Avatar name={member.displayName} size="lg" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {member.displayName}
                </p>
                <p className="text-xs text-gray-500">ID: {member.employeeId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSelf && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  自分
                </span>
              )}
              {!readOnly && !isSelf && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(member.id)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded transition duration-150"
                  title="削除"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
