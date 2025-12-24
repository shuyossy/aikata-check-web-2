import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import { GetReviewTargetService } from "@/application/reviewTarget";
import { ListQaHistoriesService } from "@/application/qaHistory";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
  ReviewTargetRepository,
  ReviewResultRepository,
  QaHistoryRepository,
} from "@/infrastructure/adapter/db";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { QaPageClient } from "./components/QaPageClient";

export const dynamic = "force-dynamic";

interface QaPageProps {
  params: Promise<{ projectId: string; spaceId: string; targetId: string }>;
}

/**
 * Q&Aページ（サーバコンポーネント）
 */
export default async function QaPage({ params }: QaPageProps) {
  const { projectId, spaceId, targetId } = await params;

  // 認証チェック
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();
  const reviewTargetRepository = new ReviewTargetRepository();
  const reviewResultRepository = new ReviewResultRepository();
  const qaHistoryRepository = new QaHistoryRepository();

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

  // レビュー対象とレビュー結果を取得
  const getReviewTargetService = new GetReviewTargetService(
    reviewTargetRepository,
    reviewResultRepository,
    reviewSpaceRepository,
    projectRepository,
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

  // Q&A履歴を取得
  const listQaHistoriesService = new ListQaHistoriesService(
    qaHistoryRepository,
    reviewTargetRepository,
    reviewSpaceRepository,
    projectRepository,
    userRepository,
  );

  let qaHistories;
  try {
    qaHistories = await listQaHistoriesService.execute({
      reviewTargetId: targetId,
      userId: authUser.userId,
      limit: 50,
    });
  } catch {
    qaHistories = { items: [], total: 0 };
  }

  // チェックリスト項目を抽出（@メンション用）
  const checklistItems = reviewTargetData.reviewResults.map((result) => ({
    id: result.id,
    content: result.checkListItemContent,
  }));

  return (
    <QaPageClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      targetId={targetId}
      targetName={reviewTargetData.name}
      checklistItems={checklistItems}
      initialHistories={qaHistories.items}
      currentUserId={authUser.userId}
      currentUserDisplayName={authUser.displayName}
    />
  );
}
