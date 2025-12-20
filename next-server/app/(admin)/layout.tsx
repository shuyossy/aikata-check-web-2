import { Header } from "@/components/layout/Header";

/**
 * 管理者ページ用レイアウト
 * ヘッダのみの構成（認証チェックはミドルウェアで実施）
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
