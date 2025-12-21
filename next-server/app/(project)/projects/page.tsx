import { ListUserProjectsService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ProjectListClient } from "./components/ProjectListClient";

// キャッシュ無効化（他ユーザからの招待等でプロジェクト一覧が変動する可能性があるため）
export const dynamic = "force-dynamic";

/**
 * プロジェクト一覧ページ（サーバコンポーネント）
 * 初期データ取得を行い、クライアントコンポーネントに渡す
 */
export default async function ProjectsPage() {
  // 認証チェック
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();

  // 初期データ取得
  const service = new ListUserProjectsService(projectRepository, userRepository);
  const initialData = await service.execute({
    userId: authUser.userId,
    page: 1,
    limit: 12,
  });

  return <ProjectListClient initialData={initialData} />;
}
