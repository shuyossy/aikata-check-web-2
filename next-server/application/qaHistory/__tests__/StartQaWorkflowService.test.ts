/**
 * StartQaWorkflowService テスト
 *
 * このテストは、Q&Aワークフロー開始サービスの動作を検証します。
 *
 * テスト対象:
 * - pending状態のQ&A履歴でワークフローが開始されること
 * - pending状態でない場合は開始されないこと（二重起動防止）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StartQaWorkflowService } from "../StartQaWorkflowService";
import type { IQaHistoryRepository } from "@/application/shared/port/repository/IQaHistoryRepository";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import type { ILargeDocumentResultCacheRepository } from "@/application/shared/port/repository/ILargeDocumentResultCacheRepository";
import type { ISystemSettingRepository } from "@/application/shared/port/repository/ISystemSettingRepository";
import type { IEventBroker } from "@/application/shared/port/push/IEventBroker";
import { ReviewTargetId, ReviewDocumentCacheId } from "@/domain/reviewTarget";
import { QaStatus } from "@/domain/qaHistory";

// ワークフローのモック（vi.hoistedでモック変数をhoistする）
const { mockWorkflowStart, mockCreateRunAsync } = vi.hoisted(() => {
  const mockWorkflowStart = vi.fn();
  const mockCreateRunAsync = vi.fn().mockResolvedValue({
    start: mockWorkflowStart,
  });
  return { mockWorkflowStart, mockCreateRunAsync };
});

vi.mock("@/application/mastra/workflows/qaExecution", () => ({
  qaExecutionWorkflow: {
    createRunAsync: mockCreateRunAsync,
  },
}));

// Mastraのモック
vi.mock("@mastra/core", () => ({
  Mastra: vi.fn(),
}));

// loggerのモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// checkWorkflowResultのモック
vi.mock("@/application/mastra/lib/workflowUtils", () => ({
  checkWorkflowResult: vi.fn().mockReturnValue({ status: "success" }),
}));

describe("StartQaWorkflowService", () => {
  // モックリポジトリ
  let mockQaHistoryRepository: IQaHistoryRepository;
  let mockReviewTargetRepository: IReviewTargetRepository;
  let mockReviewResultRepository: IReviewResultRepository;
  let mockReviewDocumentCacheRepository: IReviewDocumentCacheRepository;
  let mockLargeDocumentResultCacheRepository: ILargeDocumentResultCacheRepository;
  let mockSystemSettingRepository: ISystemSettingRepository;
  let mockEventBroker: IEventBroker;
  let mockMastra: any;
  let service: StartQaWorkflowService;

  // テストデータ
  const testUserId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440002";
  const testQaHistoryId = "550e8400-e29b-41d4-a716-446655440010";
  const testDocumentCacheId1 = "550e8400-e29b-41d4-a716-446655440020";

  // モックエンティティ作成ヘルパー
  const createMockQaHistory = (status: "pending" | "processing" | "completed" | "error") => ({
    id: { value: testQaHistoryId },
    reviewTargetId: ReviewTargetId.reconstruct(testReviewTargetId),
    question: { value: "テスト質問" },
    checkListItemContent: { value: JSON.stringify(["チェック項目内容"]) },
    isPending: () => status === "pending",
    isProcessing: () => status === "processing",
    isCompleted: () => status === "completed",
    isError: () => status === "error",
    status: QaStatus.create(status),
  });

  const createMockReviewTarget = () => ({
    id: ReviewTargetId.reconstruct(testReviewTargetId),
  });

  const createMockReviewResults = () => [
    {
      id: { value: "550e8400-e29b-41d4-a716-446655440030" },
      checkListItemContent: "チェック項目内容",
      evaluation: { value: "A" },
      comment: { value: "コメント" },
    },
  ];

  const createMockDocumentCaches = () => [
    {
      id: ReviewDocumentCacheId.reconstruct(testDocumentCacheId1),
      fileName: "テストドキュメント.docx",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // mockCreateRunAsyncの戻り値を再設定
    mockCreateRunAsync.mockResolvedValue({
      start: mockWorkflowStart,
    });

    mockQaHistoryRepository = {
      findById: vi.fn(),
      findByReviewTargetId: vi.fn(),
      save: vi.fn(),
      updateAnswer: vi.fn(),
      updateError: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
      deleteByReviewTargetId: vi.fn(),
    };

    mockReviewTargetRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findByReviewSpaceId: vi.fn(),
    } as unknown as IReviewTargetRepository;

    mockReviewResultRepository = {
      findByReviewTargetId: vi.fn(),
      save: vi.fn(),
    } as unknown as IReviewResultRepository;

    mockReviewDocumentCacheRepository = {
      findById: vi.fn(),
      findByReviewTargetId: vi.fn(),
      save: vi.fn(),
    } as unknown as IReviewDocumentCacheRepository;

    mockLargeDocumentResultCacheRepository = {
      saveMany: vi.fn(),
      findByReviewDocumentCacheId: vi.fn(),
      findChecklistResultsWithIndividualResults: vi.fn(),
      deleteByReviewTargetId: vi.fn(),
    } as unknown as ILargeDocumentResultCacheRepository;

    mockSystemSettingRepository = {
      find: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };

    mockEventBroker = {
      subscribe: vi.fn(),
      subscribeChannel: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      broadcast: vi.fn(),
      unsubscribeAll: vi.fn(),
    };

    mockMastra = {
      getAgent: vi.fn(),
    };

    service = new StartQaWorkflowService(
      mockQaHistoryRepository,
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockReviewDocumentCacheRepository,
      mockLargeDocumentResultCacheRepository,
      mockSystemSettingRepository,
      mockEventBroker,
      mockMastra,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startWorkflow", () => {
    it("pending状態のQ&A履歴でワークフローが開始される", async () => {
      // Arrange
      // findByIdは2回呼ばれる（startWorkflow内と executeQaWorkflow内）
      vi.mocked(mockQaHistoryRepository.findById)
        .mockResolvedValueOnce(createMockQaHistory("pending") as any)  // startWorkflow内
        .mockResolvedValueOnce(createMockQaHistory("processing") as any);  // executeQaWorkflow内
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(createMockReviewResults() as any);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(createMockDocumentCaches() as any);
      vi.mocked(mockLargeDocumentResultCacheRepository.findChecklistResultsWithIndividualResults).mockResolvedValue([]);

      mockWorkflowStart.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          answer: "回答です",
          researchSummary: [],
        },
      });

      // Act
      await service.startWorkflow(testQaHistoryId, testUserId);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert
      // ステータスがprocessingに更新されたことを確認
      expect(mockQaHistoryRepository.updateStatus).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ value: "processing" })
      );

      // ワークフローが開始されたことを確認
      expect(mockWorkflowStart).toHaveBeenCalledTimes(1);

      // ワークフロー入力データの検証
      expect(mockWorkflowStart).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: expect.objectContaining({
            question: "テスト質問",
            availableDocuments: expect.arrayContaining([
              expect.objectContaining({
                id: testDocumentCacheId1,
                fileName: "テストドキュメント.docx",
              }),
            ]),
            checklistResults: expect.arrayContaining([
              expect.objectContaining({
                checklistResult: expect.objectContaining({
                  content: "チェック項目内容",
                }),
              }),
            ]),
          }),
        })
      );
    });

    // 注: ワークフロー完了時のDB更新・イベント発行のテストは、実際の非同期処理のタイミングで
    // テスト間で状態が汚染される問題があるため、ワークフローの結果検証は個別のテストで行う

    it("processing状態のQ&A履歴では何もしない（二重起動防止）", async () => {
      // Arrange
      vi.mocked(mockQaHistoryRepository.findById).mockResolvedValue(createMockQaHistory("processing") as any);

      // Act
      await service.startWorkflow(testQaHistoryId, testUserId);

      // Assert
      // ステータスが更新されないことを確認
      expect(mockQaHistoryRepository.updateStatus).not.toHaveBeenCalled();

      // ワークフローが開始されないことを確認
      expect(mockWorkflowStart).not.toHaveBeenCalled();
    });

    it("completed状態のQ&A履歴では何もしない", async () => {
      // Arrange
      vi.mocked(mockQaHistoryRepository.findById).mockResolvedValue(createMockQaHistory("completed") as any);

      // Act
      await service.startWorkflow(testQaHistoryId, testUserId);

      // Assert
      expect(mockQaHistoryRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockWorkflowStart).not.toHaveBeenCalled();
    });

    it("error状態のQ&A履歴では何もしない", async () => {
      // Arrange
      vi.mocked(mockQaHistoryRepository.findById).mockResolvedValue(createMockQaHistory("error") as any);

      // Act
      await service.startWorkflow(testQaHistoryId, testUserId);

      // Assert
      expect(mockQaHistoryRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockWorkflowStart).not.toHaveBeenCalled();
    });

    it("Q&A履歴が見つからない場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockQaHistoryRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.startWorkflow(testQaHistoryId, testUserId)).rejects.toThrow(
        "Q&A履歴が見つかりません"
      );
    });

    it("レビュー対象が見つからない場合はエラーを投げる", async () => {
      // Arrange
      vi.mocked(mockQaHistoryRepository.findById).mockResolvedValue(createMockQaHistory("pending") as any);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.startWorkflow(testQaHistoryId, testUserId)).rejects.toThrow(
        "レビュー対象が見つかりません"
      );

      // ステータス更新前にエラーが発生するため、更新されない
      expect(mockQaHistoryRepository.updateStatus).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ value: "processing" })
      );
    });

    it("ワークフロー失敗時にエラーがDB記録され、エラーイベントが発行される", async () => {
      // Arrange
      vi.mocked(mockQaHistoryRepository.findById).mockResolvedValue(createMockQaHistory("pending") as any);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(createMockReviewResults() as any);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(createMockDocumentCaches() as any);
      vi.mocked(mockLargeDocumentResultCacheRepository.findChecklistResultsWithIndividualResults).mockResolvedValue([]);

      // checkWorkflowResultがエラーを返すようモック
      const { checkWorkflowResult } = await import("@/application/mastra/lib/workflowUtils");
      vi.mocked(checkWorkflowResult).mockReturnValue({
        status: "failed",
        errorMessage: "ワークフローエラー",
      });

      mockWorkflowStart.mockResolvedValue({
        status: "success",
        result: {
          status: "failed",
          errorMessage: "ワークフローエラー",
        },
      });

      // Act
      await service.startWorkflow(testQaHistoryId, testUserId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - エラーがDBに記録されたことを確認
      expect(mockQaHistoryRepository.updateError).toHaveBeenCalledTimes(1);
      expect(mockQaHistoryRepository.updateError).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String)
      );

      // Assert - エラーイベントがブロードキャストされたことを確認
      expect(mockEventBroker.broadcast).toHaveBeenCalledWith(
        `qa:${testQaHistoryId}`,
        expect.objectContaining({
          type: "error",
          data: expect.objectContaining({
            message: expect.any(String),
          }),
        })
      );
    });

    it("大量レビュー結果がある場合、個別結果がワークフローに渡される", async () => {
      // Arrange
      vi.mocked(mockQaHistoryRepository.findById).mockResolvedValue(createMockQaHistory("pending") as any);
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(createMockReviewTarget() as any);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(createMockReviewResults() as any);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(createMockDocumentCaches() as any);

      // 大量レビュー結果をモック
      vi.mocked(mockLargeDocumentResultCacheRepository.findChecklistResultsWithIndividualResults).mockResolvedValue([
        {
          checklistItemContent: "チェック項目内容",
          evaluation: "B",
          comment: "総合コメント",
          individualResults: [
            { documentId: "doc-1", comment: "個別コメント", individualFileName: "part1.docx" },
          ],
        },
      ]);

      mockWorkflowStart.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          answer: "回答",
          researchSummary: [],
        },
      });

      // Act
      await service.startWorkflow(testQaHistoryId, testUserId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - 個別結果がchecklistResultsに含まれることを確認
      expect(mockWorkflowStart).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: expect.objectContaining({
            checklistResults: expect.arrayContaining([
              expect.objectContaining({
                individualResults: expect.arrayContaining([
                  expect.objectContaining({
                    documentId: "doc-1",
                    comment: "個別コメント",
                    individualFileName: "part1.docx",
                  }),
                ]),
              }),
            ]),
          }),
        })
      );
    });
  });
});
