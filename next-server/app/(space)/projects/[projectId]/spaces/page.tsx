import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { ListProjectReviewSpacesService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ReviewSpaceListClient } from "./components/ReviewSpaceListClient";

export const dynamic = "force-dynamic";

interface SpacesPageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * レビュースペース一覧ページ（サーバコンポーネント）
 * 初期データ取得を行い、クライアントコンポーネントに渡す
 */
export default async function SpacesPage({ params }: SpacesPageProps) {
  const { projectId } = await params;

  // 認証チェック
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();

  // プロジェクト情報を取得
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

  // レビュースペース一覧を取得
  const listReviewSpacesService = new ListProjectReviewSpacesService(
    reviewSpaceRepository,
    projectRepository,
  );

  const initialData = await listReviewSpacesService.execute({
    projectId,
    userId: authUser.userId,
    page: 1,
    limit: 12,
  });

  return (
    <ReviewSpaceListClient
      projectId={projectId}
      project={project}
      initialData={initialData}
    />
  );
}
