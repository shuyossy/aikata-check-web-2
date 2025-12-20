import { redirect } from "next/navigation";

/**
 * /admin へのアクセス時は /admin/users にリダイレクト
 */
export default function AdminPage() {
  redirect("/admin/users");
}
