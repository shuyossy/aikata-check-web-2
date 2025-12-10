import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * 認証ミドルウェア
 * 未認証ユーザをサインインページにリダイレクト
 * 認証後は元のパスに戻る（callbackUrl）
 */
export default withAuth(
  function middleware(req) {
    // 管理者ページへのアクセス制御（将来用）
    // if (req.nextUrl.pathname.startsWith("/(admin)")) {
    //   // TODO: 管理者権限チェックを実装
    // }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    // pages設定を省略してNextAuthのデフォルトサインインページを使用
  },
);

/**
 * ミドルウェアの適用対象
 * - 静的ファイル、API認証エンドポイント、_nextを除外
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication API routes)
     * - auth/signin (sign in page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|auth/signin|_next/static|_next/image|favicon.ico).*)",
  ],
};
