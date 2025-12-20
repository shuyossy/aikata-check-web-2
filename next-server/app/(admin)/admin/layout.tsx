import { AdminSidebar } from "./components/AdminSidebar";

/**
 * 管理者画面用サブレイアウト
 * サイドバー付きのレイアウト
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
