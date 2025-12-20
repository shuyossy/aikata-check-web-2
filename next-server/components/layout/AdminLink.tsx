"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 管理者画面へのリンク
 * 管理者ユーザーにのみ表示
 */
export function AdminLink() {
  const { data: session } = useSession();

  // 管理者でない場合は表示しない
  if (!session?.user?.isAdmin) {
    return null;
  }

  return (
    <Button variant="ghost" size="sm" asChild className="text-gray-600">
      <Link href="/admin" className="flex items-center gap-1.5">
        <Shield className="size-4" />
        <span className="hidden sm:inline">管理</span>
      </Link>
    </Button>
  );
}
