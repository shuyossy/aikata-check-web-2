import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/auth";
import { GetProjectService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
import { NewReviewSpaceClient } from "./components/NewReviewSpaceClient";

interface NewSpacePageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * レビュースペース新規作成ページ（サーバコンポーネント）
 */
export default async function NewSpacePage({ params }: NewSpacePageProps) {
  const { projectId } = await params;

  // 認証チェック
  const session = await getServerSession(authOptions);
  if (!session?.user?.employeeId) {
    redirect("/auth/signin");
  }

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();

  // ユーザー情報を取得
  const user = await userRepository.findByEmployeeId(
    EmployeeId.create(session.user.employeeId),
  );

  if (!user) {
    throw new Error("ユーザ情報の取得に失敗しました");
  }

  // プロジェクト情報を取得（アクセス権確認）
  const getProjectService = new GetProjectService(
    projectRepository,
    userRepository,
  );
  const project = await getProjectService.execute({
    projectId,
    userId: user.id.value,
  });

  if (!project) {
    notFound();
  }

  return <NewReviewSpaceClient projectId={projectId} projectName={project.name} />;
}
