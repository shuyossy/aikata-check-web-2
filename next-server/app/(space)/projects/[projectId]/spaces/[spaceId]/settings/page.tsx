import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/auth";
import { GetReviewSpaceService } from "@/application/reviewSpace";
import {
  ProjectRepository,
  ReviewSpaceRepository,
  UserRepository,
} from "@/infrastructure/adapter/db";
import { EmployeeId } from "@/domain/user";
import { ReviewSpaceSettingsClient } from "./components/ReviewSpaceSettingsClient";

export const dynamic = "force-dynamic";

interface ReviewSpaceSettingsPageProps {
  params: Promise<{ projectId: string; spaceId: string }>;
}

/**
 * レビュースペース設定ページ（サーバーコンポーネント）
 * 初期データ取得を行い、クライアントコンポーネントに渡す
 */
export default async function ReviewSpaceSettingsPage({
  params,
}: ReviewSpaceSettingsPageProps) {
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

  // ユーザー情報を取得
  const user = await userRepository.findByEmployeeId(
    EmployeeId.create(session.user.employeeId),
  );

  if (!user) {
    throw new Error("ユーザ情報の取得に失敗しました");
  }

  // レビュースペース情報を取得
  const getReviewSpaceService = new GetReviewSpaceService(
    reviewSpaceRepository,
    projectRepository,
  );

  try {
    const reviewSpace = await getReviewSpaceService.execute({
      reviewSpaceId: spaceId,
      userId: user.id.value,
    });

    return (
      <ReviewSpaceSettingsClient
        projectId={projectId}
        spaceId={spaceId}
        initialReviewSpace={reviewSpace}
      />
    );
  } catch {
    // レビュースペースが見つからない場合のエラー画面
    return (
      <div className="bg-gray-50 min-h-screen">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              レビュースペースが見つかりません
            </h3>
            <p className="mt-2 text-gray-600">
              指定されたレビュースペースは存在しないか、アクセス権がありません
            </p>
            <Link
              href={`/projects/${projectId}/spaces`}
              className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-150 font-medium"
            >
              レビュースペース一覧に戻る
            </Link>
          </div>
        </main>
      </div>
    );
  }
}
