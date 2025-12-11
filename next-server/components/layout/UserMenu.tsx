"use client";

import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * ユーザーメニューコンポーネント
 * アバター、ユーザー情報、ドロップダウンメニュー（ログアウト等）を表示
 */
export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-gray-500">読み込み中...</span>;
  }

  if (!session?.user) {
    return null;
  }

  const displayName =
    session.user.displayName || session.user.name || "ユーザー";
  const employeeId = session.user.employeeId || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-3 py-2 h-auto"
        >
          {/* Avatar */}
          <Avatar name={displayName} size="md" />
          {/* User Info */}
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-gray-700">{displayName}</p>
            {employeeId && (
              <p className="text-xs text-gray-500">ID: {employeeId}</p>
            )}
          </div>
          {/* Dropdown Arrow */}
          <ChevronDown className="size-4 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Mobile: Show user info in dropdown */}
        <div className="md:hidden">
          <DropdownMenuLabel>
            <p className="text-sm font-medium text-gray-700">{displayName}</p>
            {employeeId && (
              <p className="text-xs text-gray-500 font-normal">
                ID: {employeeId}
              </p>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
        </div>
        {/* Logout Option */}
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="size-4" />
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
