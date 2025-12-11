import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/auth";
import { GetProjectService } from "@/application/project";
import { ListProjectReviewSpacesService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.employeeId) {
    redirect("/auth/signin");
  }

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();

  // ユーザー情報を取得
  const user = await userRepository.findByEmployeeId(
    EmployeeId.create(session.user.employeeId),
  );

  if (!user) {
    throw new Error("ユーザ情報の取得に失敗しました");
  }

  // プロジェクト情報を取得
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

  // レビュースペース一覧を取得
  const listReviewSpacesService = new ListProjectReviewSpacesService(
    reviewSpaceRepository,
    projectRepository,
  );

  const initialData = await listReviewSpacesService.execute({
    projectId,
    userId: user.id.value,
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
