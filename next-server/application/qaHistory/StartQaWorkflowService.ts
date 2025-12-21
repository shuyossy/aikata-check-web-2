import { IQaHistoryRepository } from "@/application/shared/port/repository/IQaHistoryRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import { ILargeDocumentResultCacheRepository } from "@/application/shared/port/repository/ILargeDocumentResultCacheRepository";
import { ISystemSettingRepository } from "@/application/shared/port/repository/ISystemSettingRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository/IProjectRepository";
import { IEventBroker } from "@/application/shared/port/push/IEventBroker";
import { QaHistory, QaHistoryId, Answer, ResearchSummary, QaStatus } from "@/domain/qaHistory";
import { ReviewTargetId } from "@/domain/reviewTarget";
import { ProjectId } from "@/domain/project";
import { getLogger } from "@/lib/server/logger";
import type { Mastra } from "@mastra/core";
import { RuntimeContext } from "@mastra/core/di";
import type {
  QaCompleteEvent,
  QaErrorEvent,
} from "@/application/shared/port/push/QaSseEventTypes";
import {
  qaExecutionWorkflow,
  type AvailableDocument,
  type ChecklistResultWithIndividual,
  type QaExecutionWorkflowRuntimeContext,
  type QaExecutionWorkflowOutput,
  type ResearchResult,
} from "@/application/mastra/workflows/qaExecution";
import { checkWorkflowResult } from "@/application/mastra/lib/workflowUtils";
import { resolveAiApiConfig } from "@/application/shared/lib/resolveAiApiConfig";

const logger = getLogger();

/**
 * Q&Aワークフロー開始サービス
 * SSE接続確立後にQ&Aワークフローを開始する責務を持つ
 */
export class StartQaWorkflowService {
  constructor(
    private readonly qaHistoryRepository: IQaHistoryRepository,
    private readonly reviewTargetRepository: IReviewTargetRepository,
    private readonly reviewResultRepository: IReviewResultRepository,
    private readonly reviewDocumentCacheRepository: IReviewDocumentCacheRepository,
    private readonly largeDocumentResultCacheRepository: ILargeDocumentResultCacheRepository,
    private readonly systemSettingRepository: ISystemSettingRepository,
    private readonly reviewSpaceRepository: IReviewSpaceRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly eventBroker: IEventBroker,
    private readonly mastra: Mastra,
  ) {}

  /**
   * Q&Aワークフローを開始
   * SSE接続確立後に呼び出される
   * @param qaHistoryId Q&A履歴ID
   * @param userId ユーザーID
   */
  async startWorkflow(qaHistoryId: string, userId: string): Promise<void> {
    const qaHistoryIdVo = QaHistoryId.reconstruct(qaHistoryId);
    const qaHistory = await this.qaHistoryRepository.findById(qaHistoryIdVo);

    if (!qaHistory) {
      throw new Error("Q&A履歴が見つかりません");
    }

    // pending状態でない場合はスキップ（二重起動防止）
    if (!qaHistory.isPending()) {
      logger.info({ qaHistoryId }, "ワークフローは既に開始されています");
      return;
    }

    // ステータスをprocessingに更新
    await this.qaHistoryRepository.updateStatus(qaHistoryIdVo, QaStatus.processing());

    // レビュー対象を取得
    const reviewTarget = await this.reviewTargetRepository.findById(qaHistory.reviewTargetId);
    if (!reviewTarget) {
      throw new Error("レビュー対象が見つかりません");
    }

    // 非同期でワークフロー実行
    this.executeQaWorkflow(qaHistoryIdVo, userId, qaHistory.reviewTargetId).catch((error) => {
      logger.error({ err: error, qaHistoryId }, "Q&A処理が失敗しました");
    });
  }

  /**
   * Q&Aワークフローを実行
   * @param qaHistoryId Q&A履歴ID
   * @param userId ユーザーID
   * @param reviewTargetId レビュー対象ID
   */
  private async executeQaWorkflow(
    qaHistoryId: QaHistoryId,
    userId: string,
    reviewTargetId: ReviewTargetId,
  ): Promise<void> {
    try {
      // Q&A履歴を取得
      const qaHistory = await this.qaHistoryRepository.findById(qaHistoryId);
      if (!qaHistory) {
        throw new Error("Q&A履歴が見つかりません");
      }

      // 選択されたチェックリスト項目をパース（JSON配列）
      const selectedChecklistItemContents: string[] = JSON.parse(qaHistory.checkListItemContent.value);

      // レビュー結果を取得（選択されたチェック項目のみフィルタリング）
      const allReviewResults = await this.reviewResultRepository.findByReviewTargetId(reviewTargetId);
      const reviewResults = allReviewResults.filter((r) =>
        selectedChecklistItemContents.includes(r.checkListItemContent)
      );

      // 大量レビューの個別結果を取得（選択されたチェック項目のみ）
      const largeDocumentResults = await this.largeDocumentResultCacheRepository.findChecklistResultsWithIndividualResults(
        reviewTargetId,
        selectedChecklistItemContents,
      );

      // チェックリスト結果と個別結果のマップを作成
      const individualResultsMap = new Map<string, Array<{ documentId: string; comment: string; individualFileName: string }>>();
      for (const result of largeDocumentResults) {
        individualResultsMap.set(result.checklistItemContent, result.individualResults);
      }

      // チェックリスト結果を構築
      const checklistResults: ChecklistResultWithIndividual[] = reviewResults.map((result) => ({
        checklistResult: {
          id: result.id.value,
          content: result.checkListItemContent,
          evaluation: result.evaluation?.value ?? null,
          comment: result.comment?.value ?? null,
        },
        // 大量レビューの個別結果がある場合はここに含める
        individualResults: individualResultsMap.get(result.checkListItemContent),
      }));

      // ドキュメントキャッシュを取得
      const documentCaches = await this.reviewDocumentCacheRepository.findByReviewTargetId(reviewTargetId);

      // 利用可能なドキュメントリストを構築
      const availableDocuments: AvailableDocument[] = documentCaches.map((cache) => ({
        id: cache.id.value,
        fileName: cache.fileName,
      }));

      // レビュー対象からプロジェクトを取得してAPI設定を解決
      const reviewTarget = await this.reviewTargetRepository.findById(reviewTargetId);
      if (!reviewTarget) {
        throw new Error("レビュー対象が見つかりません");
      }
      const reviewSpace = await this.reviewSpaceRepository.findById(reviewTarget.reviewSpaceId);
      if (!reviewSpace) {
        throw new Error("レビュースペースが見つかりません");
      }
      const projectId = ProjectId.reconstruct(reviewSpace.projectId.value);
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        throw new Error("プロジェクトが見つかりません");
      }

      // API設定を取得（プロジェクト設定 > 管理者設定 > 環境変数）
      const systemSetting = await this.systemSettingRepository.find();
      const aiApiConfig = resolveAiApiConfig(project.encryptedApiKey, systemSetting);

      // RuntimeContext作成
      const runtimeContext = new RuntimeContext<QaExecutionWorkflowRuntimeContext>();
      runtimeContext.set("eventBroker", this.eventBroker);
      runtimeContext.set("userId", userId);
      runtimeContext.set("qaHistoryId", qaHistoryId.value);
      runtimeContext.set("aiApiKey", aiApiConfig.apiKey);
      runtimeContext.set("aiApiUrl", aiApiConfig.apiUrl);
      runtimeContext.set("aiApiModel", aiApiConfig.apiModel);

      // ワークフローを実行
      const run = await qaExecutionWorkflow.createRunAsync();
      const workflowResult = await run.start({
        inputData: {
          question: qaHistory.question.value,
          availableDocuments,
          checklistResults,
        },
        runtimeContext,
      });

      // ワークフロー結果を確認
      const result = checkWorkflowResult(workflowResult);

      if (result.status !== "success") {
        throw new Error(result.errorMessage || "Q&A処理に失敗しました");
      }

      // ワークフローの出力を取得（型ナローイングのためstatusをチェック）
      if (workflowResult.status !== "success") {
        throw new Error("Q&A処理に失敗しました");
      }

      const output = workflowResult.result as QaExecutionWorkflowOutput | undefined;

      if (!output || output.status === "failed" || !output.answer) {
        throw new Error(output?.errorMessage || "回答の生成に失敗しました");
      }

      // Q&A履歴を更新
      const researchSummaryItems = (output.researchSummary || []).map((r: ResearchResult) => ({
        documentName: r.documentName,
        researchContent: r.researchContent,
        researchResult: r.researchResult,
      }));
      await this.qaHistoryRepository.updateAnswer(
        qaHistoryId,
        Answer.create(output.answer),
        ResearchSummary.create(researchSummaryItems),
      );

      // 完了イベントをブロードキャスト（全購読者に配信）
      const completeEvent: QaCompleteEvent = {
        type: "complete",
        data: {
          answer: output.answer,
          researchSummary: researchSummaryItems,
        },
      };
      this.eventBroker.broadcast(`qa:${qaHistoryId.value}`, completeEvent);

    } catch (error) {
      logger.error({ err: error, qaHistoryId: qaHistoryId.value }, "Q&Aワークフロー実行中にエラーが発生しました");

      // エラーを記録
      const errorMessage = error instanceof Error ? error.message : "予期せぬエラーが発生しました";
      await this.qaHistoryRepository.updateError(qaHistoryId, errorMessage);

      // エラーイベントをブロードキャスト（全購読者に配信）
      const errorEvent: QaErrorEvent = {
        type: "error",
        data: {
          message: errorMessage,
        },
      };
      this.eventBroker.broadcast(`qa:${qaHistoryId.value}`, errorEvent);
    }
  }
}
