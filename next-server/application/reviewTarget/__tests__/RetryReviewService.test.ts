import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RetryReviewService,
  type RetryReviewCommand,
} from "../RetryReviewService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type {
  IProjectRepository,
  IReviewDocumentCacheRepository,
  ISystemSettingRepository,
} from "@/application/shared/port/repository";
import { AiTaskQueueService } from "@/application/aiTask/AiTaskQueueService";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { CheckListItem } from "@/domain/checkListItem";
import { ReviewTarget, ReviewDocumentCache } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";
import { AI_TASK_TYPE } from "@/domain/aiTask";
import { domainValidationError } from "@/lib/server/error";

// vi.hoisted()でモック関数を定義（テスト間の分離のため）
const { mockResolveAiApiConfig } = vi.hoisted(() => {
  const mockResolveAiApiConfig = vi.fn().mockReturnValue({
    apiKey: "test-api-key",
    apiUrl: "https://api.example.com",
    apiModel: "test-model",
  });
  return { mockResolveAiApiConfig };
});

// resolveAiApiConfigのモック
vi.mock("@/application/shared/lib/resolveAiApiConfig", () => ({
  resolveAiApiConfig: mockResolveAiApiConfig,
}));

// AiTaskQueueServiceのモック
vi.mock("@/application/aiTask/AiTaskQueueService", () => ({
  AiTaskQueueService: vi.fn(),
}));

// AiTaskBootstrapのモック
vi.mock("@/application/aiTask", () => ({
  getAiTaskBootstrap: vi.fn(() => ({
    startWorkersForApiKeyHash: vi.fn(),
  })),
}));

describe("RetryReviewService", () => {
  // モックリポジトリ
  const mockReviewTargetRepository: IReviewTargetRepository = {
    findById: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockReviewResultRepository: IReviewResultRepository = {
    findById: vi.fn(),
    findByReviewTargetId: vi.fn(),
    countByReviewTargetId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    delete: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
  };

  const mockCheckListItemRepository: ICheckListItemRepository = {
    findById: vi.fn(),
    findByIds: vi.fn(),
    findByReviewSpaceId: vi.fn(),
    countByReviewSpaceId: vi.fn(),
    save: vi.fn(),
    bulkSave: vi.fn(),
    bulkInsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    deleteByReviewSpaceId: vi.fn(),
  };

  const mockReviewSpaceRepository: IReviewSpaceRepository = {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    countByProjectId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockProjectRepository: IProjectRepository = {
    findById: vi.fn(),
    findByMemberId: vi.fn(),
    countByMemberId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const mockReviewDocumentCacheRepository: IReviewDocumentCacheRepository = {
    findById: vi.fn(),
    findByReviewTargetId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
  };

  const mockSystemSettingRepository: ISystemSettingRepository = {
    find: vi.fn(),
    save: vi.fn(),
  };

  // モックAiTaskQueueService
  const mockEnqueueTask = vi.fn();
  const mockAiTaskQueueService = {
    enqueueTask: mockEnqueueTask,
    dequeueTask: vi.fn(),
    completeTask: vi.fn(),
    failTask: vi.fn(),
    getQueueLength: vi.fn(),
    findById: vi.fn(),
    findDistinctApiKeyHashesInQueue: vi.fn(),
    findProcessingTasks: vi.fn(),
  };

  let service: RetryReviewService;

  // テスト用データ（有効なUUID v4形式）
  const testProjectId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";
  const testUserId = "550e8400-e29b-41d4-a716-446655440003";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440004";
  const testCheckListItemId1 = "550e8400-e29b-41d4-a716-446655440005";
  const testCheckListItemId2 = "550e8400-e29b-41d4-a716-446655440006";
  const testCacheId1 = "550e8400-e29b-41d4-a716-446655440007";
  const testCacheId2 = "550e8400-e29b-41d4-a716-446655440008";
  const testTaskId = "550e8400-e29b-41d4-a716-446655440009";
  const testResultId1 = "550e8400-e29b-41d4-a716-446655440010";
  const testResultId2 = "550e8400-e29b-41d4-a716-446655440011";

  const testProject = Project.reconstruct({
    id: testProjectId,
    name: "テストプロジェクト",
    description: null,
    encryptedApiKey: null,
    members: [{ userId: testUserId, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const testReviewSpace = ReviewSpace.reconstruct({
    id: testReviewSpaceId,
    projectId: testProjectId,
    name: "テストスペース",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const testCheckListItems = [
    CheckListItem.reconstruct({
      id: testCheckListItemId1,
      reviewSpaceId: testReviewSpaceId,
      content: "チェック項目1",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    CheckListItem.reconstruct({
      id: testCheckListItemId2,
      reviewSpaceId: testReviewSpaceId,
      content: "チェック項目2",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];

  // リトライ可能なレビュー対象（completed状態）
  const createTestReviewTarget = () => {
    return ReviewTarget.reconstruct({
      id: testReviewTargetId,
      reviewSpaceId: testReviewSpaceId,
      name: "テストレビュー対象",
      status: "completed",
      reviewType: "small",
      reviewSettings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  // テスト用ドキュメントキャッシュ
  const createTestDocumentCaches = () => [
    ReviewDocumentCache.reconstruct({
      id: testCacheId1,
      reviewTargetId: testReviewTargetId,
      fileName: "test1.txt",
      processMode: "text",
      cachePath: "/cache/path/test1.txt",
      createdAt: new Date(),
    }),
    ReviewDocumentCache.reconstruct({
      id: testCacheId2,
      reviewTargetId: testReviewTargetId,
      fileName: "test2.pdf",
      processMode: "image",
      cachePath: "/cache/path/images",
      createdAt: new Date(),
    }),
  ];

  // テスト用レビュー結果（成功と失敗の混合）
  const createTestReviewResults = () => [
    ReviewResult.reconstruct({
      id: testResultId1,
      reviewTargetId: testReviewTargetId,
      checkListItemContent: "チェック項目1",
      evaluation: "A",
      comment: "問題ありません",
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    ReviewResult.reconstruct({
      id: testResultId2,
      reviewTargetId: testReviewTargetId,
      checkListItemContent: "チェック項目2",
      evaluation: null,
      comment: null,
      errorMessage: "AI処理エラー",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // resolveAiApiConfigのモックをデフォルト値にリセット
    mockResolveAiApiConfig.mockReturnValue({
      apiKey: "test-api-key",
      apiUrl: "https://api.example.com",
      apiModel: "test-model",
    });

    // モックの設定
    mockEnqueueTask.mockResolvedValue({
      taskId: testTaskId,
      queueLength: 1,
    });

    // システム設定はデフォルトでnullを返す（環境変数を使用）
    vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(null);

    service = new RetryReviewService(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
      mockReviewDocumentCacheRepository,
      mockSystemSettingRepository,
      mockAiTaskQueueService as unknown as AiTaskQueueService,
    );
  });

  describe("正常系", () => {
    it("失敗項目のみリトライでキューに登録される", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");
      expect(result.retryItems).toBe(1); // 失敗項目は1つ
      expect(result.queueLength).toBe(1);

      // レビュー対象がqueuedステータスで保存される
      expect(mockReviewTargetRepository.save).toHaveBeenCalledTimes(1);

      // キューにタスクが登録される（リトライモードで）
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
      expect(mockEnqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: AI_TASK_TYPE.SMALL_REVIEW,
          apiKey: "test-api-key",
          files: [], // リトライ時はファイルは空
        }),
      );

      // ペイロードにリトライフラグが含まれる
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.isRetry).toBe(true);
      expect(enqueueCall.payload.retryScope).toBe("failed");
      expect(enqueueCall.payload.resultsToDeleteIds).toHaveLength(1);
      expect(enqueueCall.payload.resultsToDeleteIds[0]).toBe(testResultId2);
    });

    it("全項目リトライ（前回チェックリスト使用）でキューに登録される", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "all",
        useLatestChecklist: false,
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");
      expect(result.retryItems).toBe(2); // 全項目

      // 最新チェックリストは取得されないことを確認
      expect(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).not.toHaveBeenCalled();

      // ペイロードに全削除対象が含まれる
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.resultsToDeleteIds).toHaveLength(2);
    });

    it("全項目リトライ（最新チェックリスト使用）でキューに登録される", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(testCheckListItems);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "all",
        useLatestChecklist: true,
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");
      expect(result.retryItems).toBe(2);

      // 最新のチェックリストが取得されることを確認
      expect(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).toHaveBeenCalled();

      // ペイロードのチェックリストが最新のものであることを確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.checkListItems[0].id).toBe(
        testCheckListItemId1,
      );
    });

    it("レビュー種別を変更してリトライできる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
        reviewType: "large", // 種別を変更
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");

      // タスクタイプがLARGE_REVIEWになることを確認
      expect(mockEnqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: AI_TASK_TYPE.LARGE_REVIEW,
        }),
      );

      // ペイロードのreviewTypeも変更されることを確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.reviewType).toBe("large");
    });

    it("レビュー設定を変更してリトライできる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
        reviewSettings: {
          additionalInstructions: "セキュリティに注意",
          concurrentReviewItems: 3,
        },
      };

      const result = await service.execute(command);

      expect(result.status).toBe("queued");

      // ペイロードにレビュー設定が反映されることを確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload.reviewSettings?.additionalInstructions).toBe(
        "セキュリティに注意",
      );
      expect(enqueueCall.payload.reviewSettings?.concurrentReviewItems).toBe(3);
    });
  });

  describe("異常系 - バリデーション", () => {
    it("レビュー対象が存在しない場合エラーになる", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_TARGET_NOT_FOUND",
      });
    });

    it("リトライ不可能なステータスの場合エラーになる", async () => {
      // reviewing状態のレビュー対象
      const reviewingTarget = ReviewTarget.reconstruct({
        id: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー対象",
        status: "reviewing", // リトライ不可
        reviewType: "small",
        reviewSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        reviewingTarget,
      );

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "RETRY_NOT_AVAILABLE",
      });
    });

    it("レビュースペースが存在しない場合エラーになる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_SPACE_NOT_FOUND",
      });
    });

    it("プロジェクトが存在しない場合エラーになる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_NOT_FOUND",
      });
    });

    it("プロジェクトメンバーでない場合エラーになる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);

      const nonMemberUserId = "550e8400-e29b-41d4-a716-446655440099";
      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: nonMemberUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "PROJECT_ACCESS_DENIED",
      });
    });

    it("ドキュメントキャッシュが存在しない場合エラーになる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([]);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "RETRY_NO_CACHE",
      });
    });

    it("キャッシュパスが設定されていない場合エラーになる", async () => {
      const testTarget = createTestReviewTarget();
      const invalidCache = ReviewDocumentCache.reconstruct({
        id: testCacheId1,
        reviewTargetId: testReviewTargetId,
        fileName: "test1.txt",
        processMode: "text",
        cachePath: null, // キャッシュパスなし
        createdAt: new Date(),
      });
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([invalidCache]);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "RETRY_NO_CACHE",
      });
    });

    it("全項目成功後に失敗項目のみリトライしようとするとエラーになる", async () => {
      const testTarget = createTestReviewTarget();
      // 失敗項目がない（全て成功）
      const successResults = [
        ReviewResult.reconstruct({
          id: testResultId1,
          reviewTargetId: testReviewTargetId,
          checkListItemContent: "チェック項目1",
          evaluation: "A",
          comment: "問題ありません",
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        ReviewResult.reconstruct({
          id: testResultId2,
          reviewTargetId: testReviewTargetId,
          checkListItemContent: "チェック項目2",
          evaluation: "A",
          comment: "問題ありません",
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(successResults);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed", // 失敗項目のみ指定
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "RETRY_NO_ITEMS",
      });
    });

    it("APIキーが設定されていない場合エラーになる", async () => {
      // resolveAiApiConfigがエラーをスローするように設定
      mockResolveAiApiConfig.mockImplementation(() => {
        throw domainValidationError("AI_TASK_NO_API_KEY");
      });

      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "AI_TASK_NO_API_KEY",
      });
    });
  });

  describe("キュー登録", () => {
    it("ペイロードにリトライ情報が含まれる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await service.execute(command);

      // ペイロードを確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.payload).toMatchObject({
        reviewTargetId: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        userId: testUserId,
        files: [], // リトライ時は空
        isRetry: true,
        retryScope: "failed",
      });
      expect(enqueueCall.payload.checkListItems).toHaveLength(1);
      expect(enqueueCall.payload.checkListItems[0].content).toBe(
        "チェック項目2",
      ); // 失敗項目のみ
      expect(enqueueCall.payload.resultsToDeleteIds).toHaveLength(1);
    });

    it("ファイルは登録されない（リトライ時はキャッシュを使用）", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testTarget,
      );
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(
        testReviewSpace,
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestDocumentCaches());
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(createTestReviewResults());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "all",
      };

      await service.execute(command);

      // filesが空であることを確認
      const enqueueCall = mockEnqueueTask.mock.calls[0][0];
      expect(enqueueCall.files).toEqual([]);
    });
  });
});
