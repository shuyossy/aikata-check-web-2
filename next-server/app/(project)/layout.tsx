import { Header } from "@/components/layout/Header";

/**
 * プロジェクト一覧関連ページ用レイアウト
 * ヘッダのみの構成
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
