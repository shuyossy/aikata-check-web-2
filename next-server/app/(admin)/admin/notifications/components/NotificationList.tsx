"use client";

import { SystemNotificationDto } from "@/domain/system-notification";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, GripVertical } from "lucide-react";

interface NotificationListProps {
  notifications: SystemNotificationDto[];
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

/**
 * 通知一覧コンポーネント
 */
export function NotificationList({
  notifications,
  onToggleActive,
  onDelete,
  isUpdating,
  isDeleting,
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        通知が登録されていません
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="flex items-start gap-4 py-4 px-2"
        >
          {/* ドラッグハンドル（将来用） */}
          <div className="flex-shrink-0 pt-1 text-gray-300">
            <GripVertical className="size-5" />
          </div>

          {/* メッセージ */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm ${
                notification.isActive ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {notification.message}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              表示順: {notification.displayOrder}
            </p>
          </div>

          {/* アクション */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {notification.isActive ? "有効" : "無効"}
              </span>
              <Switch
                checked={notification.isActive}
                onCheckedChange={(checked) =>
                  onToggleActive(notification.id, checked)
                }
                disabled={isUpdating}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(notification.id)}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
