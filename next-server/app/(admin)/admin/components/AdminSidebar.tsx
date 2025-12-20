"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Bell, Settings } from "lucide-react";

/**
 * 管理者サイドバーのナビゲーション項目
 */
const navItems = [
  {
    href: "/admin/users",
    label: "管理者権限",
    icon: Users,
  },
  {
    href: "/admin/notifications",
    label: "通知設定",
    icon: Bell,
  },
  {
    href: "/admin/settings",
    label: "API設定",
    icon: Settings,
  },
];

/**
 * 管理者画面用サイドバー
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">管理者メニュー</h2>
      </div>
      <nav className="p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
