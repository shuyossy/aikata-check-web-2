import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { getAuthenticatedUser } from "@/lib/server/auth";
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
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();
  const checkListItemRepository = new CheckListItemRepository();

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

  // レビュースペース情報を取得
  const getReviewSpaceService = new GetReviewSpaceService(
    reviewSpaceRepository,
    projectRepository,
  );
  const reviewSpace = await getReviewSpaceService.execute({
    reviewSpaceId: spaceId,
    userId: authUser.userId,
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
