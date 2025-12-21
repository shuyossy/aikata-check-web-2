import { notFound } from "next/navigation";
import { GetProjectService } from "@/application/project";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { fileUploadConfig } from "@/lib/server/fileUploadConfig";
import { AIChecklistGenerateClient } from "./components/AIChecklistGenerateClient";

export const dynamic = "force-dynamic";

interface AIGeneratePageProps {
  params: Promise<{ projectId: string; spaceId: string }>;
}

/**
 * AIチェックリスト生成ページ（サーバコンポーネント）
 */
export default async function AIGeneratePage({ params }: AIGeneratePageProps) {
  const { projectId, spaceId } = await params;

  // 認証チェック
  const authUser = await getAuthenticatedUser();

  // リポジトリの初期化
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const reviewSpaceRepository = new ReviewSpaceRepository();

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

  return (
    <AIChecklistGenerateClient
      projectId={projectId}
      projectName={project.name}
      spaceId={spaceId}
      spaceName={reviewSpace.name}
      maxFileSize={fileUploadConfig.maxFileSizeBytes}
    />
  );
}
