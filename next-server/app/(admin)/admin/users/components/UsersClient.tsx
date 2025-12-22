"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
import { UserPlus, Loader2 } from "lucide-react";
import { UserDto } from "@/domain/user";
import { AdminUserList } from "./AdminUserList";
import { AdminUserSearchDialog } from "./AdminUserSearchDialog";
import {
  listAdminsAction,
  grantAdminAction,
  revokeAdminAction,
} from "../actions";
import { useServerActionError } from "@/hooks";
import { showSuccess, getMessage } from "@/lib/client";

interface UsersClientProps {
  initialAdmins: UserDto[];
}

/**
 * 管理者権限管理クライアントコンポーネント
 */
export function UsersClient({ initialAdmins }: UsersClientProps) {
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<UserDto[]>(initialAdmins);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const { error, handleError, clearError } = useServerActionError();

  // 削除対象のユーザー情報を取得
  const revokeTarget = admins.find((a) => a.id === revokeTargetId);

  // 管理者一覧取得
  const { execute: loadAdmins, isPending: isLoading } = useAction(
    listAdminsAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setAdmins(data);
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "管理者一覧の取得に失敗しました");
      },
    },
  );

  // 管理者権限付与
  const { execute: grantAdmin, isPending: isGranting } = useAction(
    grantAdminAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setIsDialogOpen(false);
          loadAdmins();
          showSuccess(getMessage("SUCCESS_ADMIN_GRANTED"));
          clearError();
        }
      },
      onError: ({ error: actionError }) => {
        handleError(actionError, "管理者権限の付与に失敗しました");
      },
    },
  );

  // 管理者権限削除
  const { execute: revokeAdmin, isPending: isRevoking } = useAction(
    revokeAdminAction,
    {
      onSuccess: () => {
        setRevokeTargetId(null);
        loadAdmins();
        showSuccess(getMessage("SUCCESS_ADMIN_REVOKED"));
        clearError();
      },
      onError: ({ error: actionError }) => {
        setRevokeTargetId(null);
        handleError(actionError, "管理者権限の削除に失敗しました");
      },
    },
  );

  const handleGrantAdmin = (userId: string) => {
    grantAdmin({ targetUserId: userId });
  };

  const handleRevokeRequest = (userId: string) => {
    setRevokeTargetId(userId);
  };

  const handleRevokeConfirm = () => {
    if (revokeTargetId) {
      revokeAdmin({ targetUserId: revokeTargetId });
    }
  };

  const currentUserId = session?.user?.id || "";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          管理者権限管理
        </h1>
        <p className="text-gray-600">システム管理者の追加と削除を行います</p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 管理者一覧カード */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">管理者一覧</h2>
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <UserPlus className="size-4 mr-2" />
            管理者を追加
          </Button>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">読み込み中...</span>
            </div>
          ) : (
            <AdminUserList
              admins={admins}
              currentUserId={currentUserId}
              onRevokeAdmin={handleRevokeRequest}
              isRevoking={isRevoking}
            />
          )}
        </div>
      </div>

      {/* ユーザー検索ダイアログ */}
      <AdminUserSearchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        existingAdminIds={admins.map((a) => a.id)}
        onGrantAdmin={handleGrantAdmin}
        isGranting={isGranting}
      />

      {/* 権限削除確認ダイアログ */}
      <AlertDialog
        open={!!revokeTargetId}
        onOpenChange={(open) => !open && setRevokeTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>管理者権限を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget && (
                <>
                  <strong>{revokeTarget.displayName}</strong>{" "}
                  さんの管理者権限を削除します。
                  この操作は取り消せます（再度権限を付与できます）。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              権限を削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
