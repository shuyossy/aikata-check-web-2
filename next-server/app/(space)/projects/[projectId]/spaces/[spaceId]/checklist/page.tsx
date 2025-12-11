import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/auth";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import { ListReviewSpaceCheckListItemsService } from "@/application/checkListItem";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { CheckListItemRepository } from "@/infrastructure/adapter/db/drizzle/repository/CheckListItemRepository";
import { EmployeeId } from "@/domain/user";
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

  // チェック項目一覧を取得
  const listCheckListItemsService = new ListReviewSpaceCheckListItemsService(
    checkListItemRepository,
    reviewSpaceRepository,
    projectRepository,
  );

  const initialData = await listCheckListItemsService.execute({
    reviewSpaceId: spaceId,
    userId: user.id.value,
    page: 1,
    limit: 1000,
  });

  return (
    <CheckListEditClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      initialItems={initialData.items}
      initialTotal={initialData.total}
    />
  );
}
