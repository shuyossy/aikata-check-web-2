import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import {
  ListReviewSpaceCheckListItemsService,
  GetChecklistGenerationTaskStatusService,
} from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { AiTaskRepository } from "@/infrastructure/adapter/db/drizzle/repository/AiTaskRepository";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { CheckListEditClient } from "./components/CheckListEditClient";

export const dynamic = "force-dynamic";

interface CheckListPageProps {
  params: Promise<{ projectId: string; spaceId: string }>;
}

/**
 * チェックリスト編集ページ（サーバコンポーネント）
 * 初期データ取得を行い、クライアントコンポーネントに渡す
 */
export default async function CheckListPage({ params }: CheckListPageProps) {
  const { projectId, spaceId } = await params;

  // 認証チェック
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();
  const checkListItemRepository = new CheckListItemRepository();
  const aiTaskRepository = new AiTaskRepository();

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

  // チェック項目一覧を取得
  const listCheckListItemsService = new ListReviewSpaceCheckListItemsService(
    checkListItemRepository,
    reviewSpaceRepository,
    projectRepository,
  );

  const initialData = await listCheckListItemsService.execute({
    reviewSpaceId: spaceId,
    userId: authUser.userId,
    page: 1,
    limit: 1000,
  });

  // チェックリスト生成タスクの状態を取得
  const getTaskStatusService = new GetChecklistGenerationTaskStatusService(
    aiTaskRepository,
    reviewSpaceRepository,
    projectRepository,
  );

  const taskStatus = await getTaskStatusService.execute({
    reviewSpaceId: spaceId,
    userId: authUser.userId,
  });

  return (
    <CheckListEditClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      initialItems={initialData.items}
      initialTotal={initialData.total}
      taskStatus={taskStatus}
    />
  );
}
