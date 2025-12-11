import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { ListUserProjectsService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
import { ProjectListClient } from "./components/ProjectListClient";

// キャッシュ無効化（他ユーザからの招待等でプロジェクト一覧が変動する可能性があるため）
export const dynamic = "force-dynamic";

/**
 * プロジェクト一覧ページ（サーバコンポーネント）
 * 初期データ取得を行い、クライアントコンポーネントに渡す
 */
export default async function ProjectsPage() {
  // 認証チェック
  const session = await getServerSession(authOptions);
  if (!session?.user?.employeeId) {
    redirect("/auth/signin");
  }

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();

  // employeeIdからuserIdを取得
  const user = await userRepository.findByEmployeeId(
    EmployeeId.create(session.user.employeeId),
  );

  if (!user) {
    throw new Error("ユーザ情報の取得に失敗しました");
  }

  // 初期データ取得
  const service = new ListUserProjectsService(projectRepository, userRepository);
  const initialData = await service.execute({
    userId: user.id.value,
    page: 1,
    limit: 12,
  });

  return <ProjectListClient initialData={initialData} />;
}
