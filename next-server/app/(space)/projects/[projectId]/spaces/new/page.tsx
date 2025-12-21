import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { ProjectRepository, UserRepository } from "@/infrastructure/adapter/db";
import { getAuthenticatedUser } from "@/lib/server/auth";
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
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();

  // プロジェクト情報を取得（アクセス権確認）
  const getProjectService = new GetProjectService(
    projectRepository,
    userRepository,
  );
  const project = await getProjectService.execute({
    projectId,
    userId: authUser.userId,
  });

  if (!project) {
    notFound();
  }

  return <NewReviewSpaceClient projectId={projectId} projectName={project.name} />;
}
