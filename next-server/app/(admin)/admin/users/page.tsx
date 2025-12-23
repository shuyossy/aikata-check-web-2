import { UserRepository } from "@/infrastructure/adapter/db";
import { ListAdminsService } from "@/application/admin";
import { UsersClient } from "./components/UsersClient";

// ビルド時のpre-renderingをスキップ（DBアクセスが必要なため）
export const dynamic = "force-dynamic";

/**
 * 管理者権限管理ページ（サーバーコンポーネント）
 * RSCで初期データを取得してクライアントコンポーネントに渡す
 */
export default async function AdminUsersPage() {
  const repository = new UserRepository();
  const service = new ListAdminsService(repository);
  const admins = await service.execute();

  return <UsersClient initialAdmins={admins} />;
}
