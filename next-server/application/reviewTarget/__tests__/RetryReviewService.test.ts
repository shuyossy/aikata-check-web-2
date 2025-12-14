import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RetryReviewService,
  type RetryReviewCommand,
} from "../RetryReviewService";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { IProjectRepository, IReviewDocumentCacheRepository } from "@/application/shared/port/repository";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";
import { CheckListItem } from "@/domain/checkListItem";
import { ReviewTarget, ReviewTargetId, ReviewDocumentCache } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";

// ReviewCacheHelperのモック
vi.mock("@/lib/server/reviewCacheHelper", () => ({
  ReviewCacheHelper: {
    loadTextCache: vi.fn().mockResolvedValue("キャッシュされたテキスト内容"),
    loadImageCache: vi.fn().mockResolvedValue(["base64image1", "base64image2"]),
  },
}));

// Mastraワークフローのモック
const mockStart = vi.fn();
const mockCreateRunAsync = vi.fn(() => ({
  start: mockStart,
}));
const mockGetWorkflow = vi.fn(() => ({
  createRunAsync: mockCreateRunAsync,
}));

vi.mock("@/application/mastra", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/application/mastra")>();
  return {
    ...original,
    mastra: {
      getWorkflow: () => mockGetWorkflow(),
    },
  };
});

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
    findByReviewTargetId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
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
    const target = ReviewTarget.reconstruct({
      id: testReviewTargetId,
      reviewSpaceId: testReviewSpaceId,
      name: "テストレビュー対象",
      status: "completed",
      reviewType: "small",
      reviewSettings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return target;
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
    ReviewResult.createSuccess({
      reviewTargetId: testReviewTargetId,
      checkListItemContent: "チェック項目1",
      evaluation: "A",
      comment: "問題ありません",
    }),
    ReviewResult.createError({
      reviewTargetId: testReviewTargetId,
      checkListItemContent: "チェック項目2",
      errorMessage: "AI処理エラー",
    }),
  ];

  // ワークフロー成功時のモックレスポンス
  const createSuccessWorkflowResponse = () => ({
    status: "success",
    result: {
      status: "success",
      reviewResults: [
        {
          checkListItemContent: "チェック項目2",
          evaluation: "B",
          comment: "修正済み",
          errorMessage: null,
        },
      ],
    },
  });

  // 全項目リトライ時のワークフロー成功レスポンス
  const createAllItemsRetryWorkflowResponse = () => ({
    status: "success",
    result: {
      status: "success",
      reviewResults: [
        {
          checkListItemContent: "チェック項目1",
          evaluation: "A",
          comment: "問題なし",
          errorMessage: null,
        },
        {
          checkListItemContent: "チェック項目2",
          evaluation: "B",
          comment: "修正済み",
          errorMessage: null,
        },
      ],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RetryReviewService(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
      mockReviewDocumentCacheRepository,
    );
  });

  describe("正常系", () => {
    it("失敗項目のみリトライが成功する", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        createTestDocumentCaches(),
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      mockStart.mockResolvedValue(createSuccessWorkflowResponse());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      const result = await service.execute(command);

      expect(result.status).toBe("completed");
      expect(result.retryItems).toBe(1); // 失敗項目は1つ
      expect(result.reviewResults).toHaveLength(1);
      expect(result.reviewResults[0].evaluation).toBe("B");

      // 削除されたのは失敗項目のみであることを確認
      expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(1);

      // ワークフローがキャッシュモードで実行されることを確認
      const startCall = mockStart.mock.calls[0][0];
      const runtimeContext = startCall.runtimeContext;
      expect(runtimeContext.get("useCachedDocuments")).toBe(true);
      expect(runtimeContext.get("cachedDocuments")).toBeDefined();
    });

    it("全項目リトライ（前回チェックリスト使用）が成功する", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        createTestDocumentCaches(),
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      mockStart.mockResolvedValue(createAllItemsRetryWorkflowResponse());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "all",
        useLatestChecklist: false,
      };

      const result = await service.execute(command);

      expect(result.status).toBe("completed");
      expect(result.retryItems).toBe(2); // 全項目
      expect(result.reviewResults).toHaveLength(2);

      // 既存の結果が全て削除されることを確認
      expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(2);

      // 最新チェックリストは取得されないことを確認
      expect(mockCheckListItemRepository.findByReviewSpaceId).not.toHaveBeenCalled();
    });

    it("全項目リトライ（最新チェックリスト使用）が成功する", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        createTestDocumentCaches(),
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(
        testCheckListItems,
      );
      mockStart.mockResolvedValue(createAllItemsRetryWorkflowResponse());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "all",
        useLatestChecklist: true,
      };

      const result = await service.execute(command);

      expect(result.status).toBe("completed");
      expect(result.retryItems).toBe(2);

      // 最新のチェックリストが取得されることを確認
      expect(mockCheckListItemRepository.findByReviewSpaceId).toHaveBeenCalled();
    });

    it("レビュー種別を変更してリトライできる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        createTestDocumentCaches(),
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      mockStart.mockResolvedValue(createSuccessWorkflowResponse());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
        reviewType: "large", // 種別を変更
      };

      const result = await service.execute(command);

      expect(result.status).toBe("completed");

      // ワークフロー入力にreviewTypeが反映されることを確認
      const startCall = mockStart.mock.calls[0][0];
      expect(startCall.inputData.reviewType).toBe("large");
    });

    it("レビュー設定を変更してリトライできる", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        createTestDocumentCaches(),
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      mockStart.mockResolvedValue(createSuccessWorkflowResponse());

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

      expect(result.status).toBe("completed");

      // ワークフロー入力にreviewSettingsが反映されることを確認
      const startCall = mockStart.mock.calls[0][0];
      expect(startCall.inputData.reviewSettings?.additionalInstructions).toBe("セキュリティに注意");
      expect(startCall.inputData.reviewSettings?.concurrentReviewItems).toBe(3);
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
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewingTarget);

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
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
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
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
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
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
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
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue([]);

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
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue([
        invalidCache,
      ]);

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
        ReviewResult.createSuccess({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: "チェック項目1",
          evaluation: "A",
          comment: "問題ありません",
        }),
        ReviewResult.createSuccess({
          reviewTargetId: testReviewTargetId,
          checkListItemContent: "チェック項目2",
          evaluation: "A",
          comment: "問題ありません",
        }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        createTestDocumentCaches(),
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(successResults);

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed", // 失敗項目のみ指定
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "RETRY_NO_ITEMS",
      });
    });
  });

  describe("異常系 - ワークフロー失敗", () => {
    it("ワークフローが失敗した場合、ステータスがerrorに更新される", async () => {
      const testTarget = createTestReviewTarget();
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        createTestDocumentCaches(),
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      mockStart.mockResolvedValue({
        status: "failed",
        result: {
          status: "failed",
          errorMessage: "AI処理に失敗しました",
        },
      });

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await expect(service.execute(command)).rejects.toMatchObject({
        messageCode: "REVIEW_EXECUTION_FAILED",
      });

      // ステータスがerrorに更新されることを確認
      const saveCalls = vi.mocked(mockReviewTargetRepository.save).mock.calls;
      const lastSave = saveCalls[saveCalls.length - 1][0] as ReviewTarget;
      expect(lastSave.status.value).toBe("error");
    });
  });

  describe("キャッシュ読み込み", () => {
    it("テキストモードのキャッシュが正しく読み込まれる", async () => {
      const { ReviewCacheHelper } = await import("@/lib/server/reviewCacheHelper");

      const testTarget = createTestReviewTarget();
      // テキストモードのキャッシュのみ
      const textOnlyCache = [
        ReviewDocumentCache.reconstruct({
          id: testCacheId1,
          reviewTargetId: testReviewTargetId,
          fileName: "test.txt",
          processMode: "text",
          cachePath: "/cache/path/test.txt",
          createdAt: new Date(),
        }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        textOnlyCache,
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      mockStart.mockResolvedValue(createSuccessWorkflowResponse());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await service.execute(command);

      // ReviewCacheHelper.loadTextCacheが呼ばれることを確認
      expect(ReviewCacheHelper.loadTextCache).toHaveBeenCalledWith("/cache/path/test.txt");
    });

    it("画像モードのキャッシュが正しく読み込まれる", async () => {
      const { ReviewCacheHelper } = await import("@/lib/server/reviewCacheHelper");

      const testTarget = createTestReviewTarget();
      // 画像モードのキャッシュのみ
      const imageOnlyCache = [
        ReviewDocumentCache.reconstruct({
          id: testCacheId2,
          reviewTargetId: testReviewTargetId,
          fileName: "test.pdf",
          processMode: "image",
          cachePath: "/cache/path/images",
          createdAt: new Date(),
        }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(testTarget);
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(
        imageOnlyCache,
      );
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(
        createTestReviewResults(),
      );
      mockStart.mockResolvedValue(createSuccessWorkflowResponse());

      const command: RetryReviewCommand = {
        reviewTargetId: testReviewTargetId,
        userId: testUserId,
        retryScope: "failed",
      };

      await service.execute(command);

      // ReviewCacheHelper.loadImageCacheが呼ばれることを確認
      expect(ReviewCacheHelper.loadImageCache).toHaveBeenCalledWith("/cache/path/images");
    });
  });
});
