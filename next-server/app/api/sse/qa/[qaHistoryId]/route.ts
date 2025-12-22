import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { InMemoryEventBroker } from "@/infrastructure/adapter/push/InMemoryEventBroker";
import { QaHistoryRepository } from "@/infrastructure/adapter/db/drizzle/repository/QaHistoryRepository";
import { ReviewTargetRepository } from "@/infrastructure/adapter/db/drizzle/repository/ReviewTargetRepository";
import { ReviewSpaceRepository } from "@/infrastructure/adapter/db/drizzle/repository/ReviewSpaceRepository";
import { ProjectRepository } from "@/infrastructure/adapter/db/drizzle/repository/ProjectRepository";
import { ReviewResultRepository } from "@/infrastructure/adapter/db/drizzle/repository/ReviewResultRepository";
import { ReviewDocumentCacheRepository } from "@/infrastructure/adapter/db/drizzle/repository/ReviewDocumentCacheRepository";
import { LargeDocumentResultCacheRepository } from "@/infrastructure/adapter/db/drizzle/repository/LargeDocumentResultCacheRepository";
import { SystemSettingRepository } from "@/infrastructure/adapter/db/drizzle/repository/SystemSettingRepository";
import { QaHistoryId } from "@/domain/qaHistory";
import { ReviewSpaceId } from "@/domain/reviewSpace";
import { ProjectId } from "@/domain/project";
import { getLogger } from "@/lib/server/logger";
import type { QaSseEvent } from "@/application/shared/port/push/QaSseEventTypes";
import { StartQaWorkflowService } from "@/application/qaHistory";
import { mastra } from "@/application/mastra";

const logger = getLogger();

/**
 * Q&A SSEストリームのGETハンドラー
 * Q&A処理の進捗をリアルタイムでクライアントに通知する
 * SSE接続確立後にQ&Aワークフローを開始する
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ qaHistoryId: string }> },
): Promise<Response> {
  const { qaHistoryId } = await params;

  // 認証チェック
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Q&A履歴の存在確認
    const qaHistoryRepository = new QaHistoryRepository();
    const qaHistoryIdVo = QaHistoryId.reconstruct(qaHistoryId);
    const qaHistory = await qaHistoryRepository.findById(qaHistoryIdVo);

    if (!qaHistory) {
      return NextResponse.json(
        { error: "Q&A history not found" },
        { status: 404 },
      );
    }

    // レビュー対象の取得
    const reviewTargetRepository = new ReviewTargetRepository();
    const reviewTarget = await reviewTargetRepository.findById(
      qaHistory.reviewTargetId,
    );

    if (!reviewTarget) {
      return NextResponse.json(
        { error: "Review target not found" },
        { status: 404 },
      );
    }

    // レビュースペースの取得
    const reviewSpaceRepository = new ReviewSpaceRepository();
    const reviewSpaceId = ReviewSpaceId.reconstruct(
      reviewTarget.reviewSpaceId.value,
    );
    const reviewSpace = await reviewSpaceRepository.findById(reviewSpaceId);

    if (!reviewSpace) {
      return NextResponse.json(
        { error: "Review space not found" },
        { status: 404 },
      );
    }

    // プロジェクトの権限チェック
    const projectRepository = new ProjectRepository();
    const projectId = ProjectId.reconstruct(reviewSpace.projectId.value);
    const project = await projectRepository.findById(projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.hasMember(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // SSEストリームを作成
    const encoder = new TextEncoder();
    const eventBroker = InMemoryEventBroker.getInstance();

    const stream = new ReadableStream({
      async start(controller) {
        const channel = `qa:${qaHistoryId}`;

        // チャンネル購読（ユーザーIDに依存しない）
        const subscriptionId = eventBroker.subscribeChannel(
          channel,
          (data: unknown) => {
            const event = data as QaSseEvent;
            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          },
        );

        logger.info(
          { qaHistoryId, userId, subscriptionId, channel },
          "SSE channel subscription started for Q&A",
        );

        // 接続確認用の初期イベントを送信
        const connectedEvent = `data: ${JSON.stringify({ type: "connected", data: { qaHistoryId } })}\n\n`;
        controller.enqueue(encoder.encode(connectedEvent));

        // ワークフロー開始イベントを送信（進捗表示改善のため）
        const workflowStartEvent = `data: ${JSON.stringify({ type: "workflow_start", data: { message: "質問を分析しています..." } })}\n\n`;
        controller.enqueue(encoder.encode(workflowStartEvent));

        // 購読登録完了後にワークフローを開始
        try {
          const startWorkflowService = new StartQaWorkflowService(
            qaHistoryRepository,
            reviewTargetRepository,
            new ReviewResultRepository(),
            new ReviewDocumentCacheRepository(),
            new LargeDocumentResultCacheRepository(),
            new SystemSettingRepository(),
            new ReviewSpaceRepository(),
            new ProjectRepository(),
            eventBroker,
            mastra,
          );
          await startWorkflowService.startWorkflow(qaHistoryId, userId);
        } catch (error) {
          logger.error(
            { err: error, qaHistoryId },
            "ワークフロー開始に失敗しました",
          );
          // エラーイベントを送信
          const errorEvent = `data: ${JSON.stringify({ type: "error", data: { message: "処理の開始に失敗しました" } })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
        }

        // クライアントの切断検知
        request.signal.addEventListener("abort", () => {
          eventBroker.unsubscribe(subscriptionId);
          controller.close();
          logger.info(
            { qaHistoryId, userId, subscriptionId, channel },
            "SSE channel subscription ended for Q&A",
          );
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error(
      { err: error, qaHistoryId, userId },
      "Error creating SSE stream for Q&A",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
