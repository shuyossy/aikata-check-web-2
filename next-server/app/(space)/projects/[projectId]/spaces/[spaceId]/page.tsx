import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import { ListReviewSpaceCheckListItemsService } from "@/application/checkListItem";
import { ListReviewTargetsService } from "@/application/reviewTarget";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
  ReviewTargetRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ReviewTargetListClient } from "./components/ReviewTargetListClient";

export const dynamic = "force-dynamic";

interface ReviewSpacePageProps {
  params: Promise<{ projectId: string; spaceId: string }>;
}

/**
 * レビュー対象一覧ページ（サーバコンポーネント）
 * 初期データ取得を行い、クライアントコンポーネントに渡す
 */
export default async function ReviewSpacePage({ params }: ReviewSpacePageProps) {
  const { projectId, spaceId } = await params;

  // 認証チェック
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();
  const checkListItemRepository = new CheckListItemRepository();
  const reviewTargetRepository = new ReviewTargetRepository();

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

  // チェック項目数を取得
  const listCheckListItemsService = new ListReviewSpaceCheckListItemsService(
    checkListItemRepository,
    reviewSpaceRepository,
    projectRepository,
  );

  const checkListData = await listCheckListItemsService.execute({
    reviewSpaceId: spaceId,
    userId: authUser.userId,
    page: 1,
    limit: 1,
  });

  // レビュー対象一覧を取得
  const listReviewTargetsService = new ListReviewTargetsService(
    reviewTargetRepository,
    reviewSpaceRepository,
    projectRepository
  );

  const reviewTargetsData = await listReviewTargetsService.execute({
    reviewSpaceId: spaceId,
    userId: authUser.userId,
  });

  return (
    <ReviewTargetListClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      spaceDescription={reviewSpace.description}
      checkListItemCount={checkListData.total}
      defaultReviewSettings={reviewSpace.defaultReviewSettings}
      reviewTargets={reviewTargetsData.reviewTargets}
    />
  );
}
