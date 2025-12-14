import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/auth";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { EmployeeId } from "@/domain/user";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { fileUploadConfig } from "@/lib/server/fileUploadConfig";
import { ReviewExecutionClient } from "./components/ReviewExecutionClient";

export const dynamic = "force-dynamic";

interface ReviewNewPageProps {
  params: Promise<{ projectId: string; spaceId: string }>;
}

/**
 * 新規レビュー実行ページ（サーバコンポーネント）
 */
export default async function ReviewNewPage({ params }: ReviewNewPageProps) {
  const { projectId, spaceId } = await params;

  // 認証チェック
  const session = await getServerSession(authOptions);
  if (!session?.user?.employeeId) {
    redirect("/auth/signin");
  }

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();
  const checkListItemRepository = new CheckListItemRepository();

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

  // レビュースペース情報を取得
  const getReviewSpaceService = new GetReviewSpaceService(
    reviewSpaceRepository,
    projectRepository,
  );
  const reviewSpace = await getReviewSpaceService.execute({
    reviewSpaceId: spaceId,
    userId: user.id.value,
  });

  if (!reviewSpace) {
    notFound();
  }

  // チェックリスト件数を取得
  const reviewSpaceIdVo = ReviewSpaceId.reconstruct(spaceId);
  const checklistCount =
    await checkListItemRepository.countByReviewSpaceId(reviewSpaceIdVo);

  return (
    <ReviewExecutionClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      defaultReviewSettings={reviewSpace.defaultReviewSettings}
      checklistCount={checklistCount}
      maxFileSize={fileUploadConfig.maxFileSizeBytes}
    />
  );
}
