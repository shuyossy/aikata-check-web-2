import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import { GetReviewTargetService, GetRetryInfoService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
  CheckListItemRepository,
  ReviewDocumentCacheRepository,
} from "@/infrastructure/adapter/db";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ReviewResultsClient } from "./components/ReviewResultsClient";

export const dynamic = "force-dynamic";

interface ReviewResultsPageProps {
  params: Promise<{ projectId: string; spaceId: string; targetId: string }>;
}

/**
 * レビュー結果ページ（サーバコンポーネント）
 */
export default async function ReviewResultsPage({
  params,
}: ReviewResultsPageProps) {
  const { projectId, spaceId, targetId } = await params;

  // 認証チェック
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();
  const reviewTargetRepository = new ReviewTargetRepository();
  const reviewResultRepository = new ReviewResultRepository();
  const checkListItemRepository = new CheckListItemRepository();
  const reviewDocumentCacheRepository = new ReviewDocumentCacheRepository();

  // プロジェクト情報を取得
  const getProjectService = new GetProjectService(
    projectRepository,
    userRepository
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
    projectRepository
  );
  const reviewSpace = await getReviewSpaceService.execute({
    reviewSpaceId: spaceId,
    userId: authUser.userId,
  });

  if (!reviewSpace) {
    notFound();
  }

  // レビュー対象とレビュー結果を取得
  const getReviewTargetService = new GetReviewTargetService(
    reviewTargetRepository,
    reviewResultRepository,
    reviewSpaceRepository,
    projectRepository
  );

  let reviewTargetData;
  try {
    reviewTargetData = await getReviewTargetService.execute({
      reviewTargetId: targetId,
      userId: authUser.userId,
    });
  } catch {
    notFound();
  }

  // リトライ情報を取得
  const getRetryInfoService = new GetRetryInfoService(
    reviewTargetRepository,
    reviewResultRepository,
    checkListItemRepository,
    reviewDocumentCacheRepository,
    reviewSpaceRepository,
    projectRepository
  );

  let canRetry = false;
  try {
    const retryInfo = await getRetryInfoService.execute({
      reviewTargetId: targetId,
      userId: authUser.userId,
    });
    canRetry = retryInfo.canRetry;
  } catch {
    // リトライ情報取得に失敗した場合はリトライ不可
    canRetry = false;
  }

  return (
    <ReviewResultsClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      targetId={targetId}
      reviewTarget={reviewTargetData}
      canRetry={canRetry}
    />
  );
}
