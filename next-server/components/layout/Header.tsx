import { UserMenu } from "./UserMenu";

/**
 * アプリケーションヘッダー
 * ロゴとユーザーメニューを表示
 */
export function Header() {
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
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
