"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * アプリケーションヘッダー
 * ユーザプロフィールとドロップダウンメニューを表示
 */
export function Header() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ユーザ名の先頭1文字を取得（アバター用）
  const getInitial = (name: string | undefined | null) => {
    if (!name) return "U";
    return name.charAt(0);
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-primary-600">AIKATA</h1>
          </div>

          {/* Right: User Menu */}
          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <span className="text-sm text-gray-500">読み込み中...</span>
            ) : session?.user ? (
              <div className="relative" ref={dropdownRef}>
                {/* User Profile Button */}
                <Button
                  variant="ghost"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 h-auto"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-sm">
                    {getInitial(session.user.displayName)}
                  </div>
                  {/* User Info */}
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-700">
                      {session.user.displayName}
                    </p>
                    <p className="text-xs text-gray-500">
                      ID: {session.user.employeeId}
                    </p>
                  </div>
                  {/* Dropdown Arrow */}
                  <ChevronDown className="size-4 text-gray-400" />
                </Button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    {/* Mobile: Show user info in dropdown */}
                    <div className="md:hidden px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-700">
                        {session.user.displayName}
                      </p>
                      <p className="text-xs text-gray-500">
                        ID: {session.user.employeeId}
                      </p>
                    </div>
                    {/* Logout Option */}
                    <Button
                      variant="ghost"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full justify-start rounded-none px-4 py-2 h-auto text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="size-4 text-gray-500" />
                      ログアウト
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
