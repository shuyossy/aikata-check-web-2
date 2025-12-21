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
import { RetryReviewClient } from "./components/RetryReviewClient";

export const dynamic = "force-dynamic";

interface RetryReviewPageProps {
  params: Promise<{ projectId: string; spaceId: string; targetId: string }>;
}

/**
 * リトライレビューページ（サーバコンポーネント）
 */
export default async function RetryReviewPage({ params }: RetryReviewPageProps) {
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

  // レビュー対象情報を取得
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

  let retryInfo;
  try {
    retryInfo = await getRetryInfoService.execute({
      reviewTargetId: targetId,
      userId: authUser.userId,
    });
  } catch {
    // リトライ情報取得に失敗した場合はリトライ不可として扱う
    retryInfo = {
      canRetry: false,
      reviewType: null,
      previousSettings: null,
      failedItemCount: 0,
      totalItemCount: 0,
      hasChecklistDiff: false,
      snapshotChecklistCount: 0,
      currentChecklistCount: 0,
    };
  }

  // 外部APIレビュー（reviewType="api"）の場合、リトライ不可として扱う
  // RetryReviewClientはapiタイプを除外した型を期待するため、適切に変換する
  const isApiReview = retryInfo.reviewType === "api";
  const retryInfoForClient = {
    ...retryInfo,
    // apiタイプの場合はnullに変換（リトライ画面ではapiタイプは扱わない）
    reviewType: (isApiReview ? null : retryInfo.reviewType) as Exclude<typeof retryInfo.reviewType, "api">,
    // apiタイプの場合はcanRetryもfalseにする
    canRetry: isApiReview ? false : retryInfo.canRetry,
    // リトライ不可の理由（外部APIレビューの場合のみ設定）
    retryNotAllowedReason: isApiReview ? ("api_review" as const) : undefined,
  };

  return (
    <RetryReviewClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      targetId={targetId}
      targetName={reviewTargetData.name}
      retryInfo={retryInfoForClient}
    />
  );
}
