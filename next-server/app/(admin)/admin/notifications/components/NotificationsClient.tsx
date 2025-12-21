"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2 } from "lucide-react";
import { SystemNotificationDto } from "@/domain/system-notification";
import { NotificationList } from "./NotificationList";
import { NotificationForm } from "./NotificationForm";
import {
  listNotificationsAction,
  createNotificationAction,
  updateNotificationAction,
  deleteNotificationAction,
} from "../actions";
import { useServerActionError } from "@/hooks";
import { showSuccess, getMessage } from "@/lib/client";

interface NotificationsClientProps {
  initialNotifications: SystemNotificationDto[];
}

/**
 * 通知設定管理クライアントコンポーネント
 */
export function NotificationsClient({
  initialNotifications,
}: NotificationsClientProps) {
  const [notifications, setNotifications] =
    useState<SystemNotificationDto[]>(initialNotifications);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { error, handleError, clearError } = useServerActionError();

  // 通知一覧取得
  const { execute: loadNotifications, isPending: isLoading } = useAction(
    listNotificationsAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setNotifications(data.notifications);
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "通知一覧の取得に失敗しました");
      },
    }
  );

  // 通知作成
  const { execute: createNotification, isPending: isCreating } = useAction(
    createNotificationAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setIsFormOpen(false);
          loadNotifications({ page: 1, limit: 100 });
          showSuccess(getMessage("SUCCESS_NOTIFICATION_CREATED"));
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "通知の作成に失敗しました");
      },
    }
  );

  // 通知更新
  const { execute: updateNotification, isPending: isUpdating } = useAction(
    updateNotificationAction,
    {
      onSuccess: () => {
        loadNotifications({ page: 1, limit: 100 });
        showSuccess(getMessage("SUCCESS_NOTIFICATION_UPDATED"));
        clearError();
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "通知の更新に失敗しました");
      },
    }
  );

  // 通知削除
  const { execute: deleteNotification, isPending: isDeleting } = useAction(
    deleteNotificationAction,
    {
      onSuccess: () => {
        setDeleteTargetId(null);
        loadNotifications({ page: 1, limit: 100 });
        showSuccess(getMessage("SUCCESS_NOTIFICATION_DELETED"));
        clearError();
      },
      onError: ({ error: actionError }) => {
        setDeleteTargetId(null);
        handleError(actionError, "通知の削除に失敗しました");
      },
    }
  );

  const handleCreateNotification = (data: {
    message: string;
    displayOrder: number;
    isActive: boolean;
  }) => {
    createNotification(data);
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    updateNotification({ id, isActive });
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleDeleteConfirm = () => {
    if (deleteTargetId) {
      deleteNotification({ id: deleteTargetId });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">通知設定</h1>
        <p className="text-gray-600">
          ユーザーに表示する通知メッセージを管理します
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 通知一覧カード */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">通知一覧</h2>
          <Button onClick={() => setIsFormOpen(true)} size="sm">
            <Plus className="size-4 mr-2" />
            通知を追加
          </Button>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">読み込み中...</span>
            </div>
          ) : (
            <NotificationList
              notifications={notifications}
              onToggleActive={handleToggleActive}
              onDelete={handleDeleteRequest}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
            />
          )}
        </div>
      </div>

      {/* 通知作成ダイアログ */}
      <NotificationForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleCreateNotification}
        isSubmitting={isCreating}
      />

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>通知を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。削除された通知は復元できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
