import { redirect } from "next/navigation";

/**
 * ルートページ
 * 認証済みユーザーはプロジェクト一覧へリダイレクト
 */
export default function Home() {
  redirect("/projects");
}
