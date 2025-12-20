import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { AdminLink } from "./AdminLink";

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
            <Link href="/projects">
              <h1 className="text-xl font-bold text-primary-600 hover:text-primary-700 transition-colors">
                AIKATA
              </h1>
            </Link>
          </div>

          {/* Right: User Menu */}
          <div className="flex items-center gap-3">
            <AdminLink />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
