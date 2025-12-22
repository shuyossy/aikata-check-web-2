import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/auth";
import {
  GetProjectService,
  ListUserProjectsService,
} from "@/application/project";
import { ListProjectReviewSpacesService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  ReviewTargetRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { ListReviewTargetsService } from "@/application/reviewTarget";
import { EmployeeId } from "@/domain/user";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProjectHeader } from "./components/ProjectHeader";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

/**
 * プロジェクト配下のレイアウト
 * サイドバーとヘッダーを含む
 */
export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
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
  const reviewTargetRepository = new ReviewTargetRepository();

  // ユーザー情報を取得
  const user = await userRepository.findByEmployeeId(
    EmployeeId.create(session.user.employeeId),
  );

  if (!user) {
    throw new Error("ユーザ情報の取得に失敗しました");
  }

  // 現在のプロジェクトを取得
  const getProjectService = new GetProjectService(
    projectRepository,
    userRepository,
  );
  const currentProject = await getProjectService.execute({
    projectId,
    userId: user.id.value,
  });

  if (!currentProject) {
    notFound();
  }

  // ユーザーが所属するプロジェクト一覧を取得
  const listProjectsService = new ListUserProjectsService(
    projectRepository,
    userRepository,
  );
  const projectsResult = await listProjectsService.execute({
    userId: user.id.value,
    limit: 100, // プロジェクト切り替え用に十分な数を取得
  });

  // 現在のプロジェクトのレビュースペース一覧を取得
  const listReviewSpacesService = new ListProjectReviewSpacesService(
    reviewSpaceRepository,
    projectRepository,
  );
  const reviewSpacesResult = await listReviewSpacesService.execute({
    projectId,
    userId: user.id.value,
    limit: 100, // サイドバー用に十分な数を取得
  });

  // 各レビュースペースのレビュー対象を取得（サイドバー表示用）
  const listReviewTargetsService = new ListReviewTargetsService(
    reviewTargetRepository,
    reviewSpaceRepository,
    projectRepository,
  );

  const reviewSpacesWithTargets = await Promise.all(
    reviewSpacesResult.spaces.map(async (space) => {
      const targetsResult = await listReviewTargetsService.execute({
        reviewSpaceId: space.id,
        userId: user.id.value,
        limit: 11, // 10件超過判定のため11件取得
      });

      const hasMore = targetsResult.reviewTargets.length > 10;
      const displayTargets = targetsResult.reviewTargets.slice(0, 10);

      return {
        id: space.id,
        name: space.name,
        reviewTargets: displayTargets.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status as
            | "pending"
            | "queued"
            | "reviewing"
            | "completed"
            | "error",
        })),
        hasMore,
      };
    }),
  );

  return (
    <div className="flex h-full bg-gray-50">
      {/* サイドバー */}
      <Sidebar
        currentProject={{
          id: currentProject.id,
          name: currentProject.name,
          description: currentProject.description,
          memberCount: currentProject.members.length,
          memberPreview: currentProject.members.slice(0, 3).map((m) => ({
            userId: m.userId,
            displayName: m.displayName || `ユーザー${m.userId.slice(0, 4)}`,
          })),
          updatedAt: new Date(currentProject.updatedAt).toISOString(),
        }}
        projects={projectsResult.projects}
        reviewSpaces={reviewSpacesWithTargets}
      />

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <ProjectHeader projectName={currentProject.name} />

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
