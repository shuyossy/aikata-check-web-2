import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { GetRetryInfoService, GetRetryInfoCommand, RetryInfoDto } from "../GetRetryInfoService";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { ReviewTarget, ReviewDocumentCache } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";
import { CheckListItem } from "@/domain/checkListItem";
import { ReviewSpace } from "@/domain/reviewSpace";
import { Project } from "@/domain/project";

// テスト用のUUID
const TEST_TARGET_ID = randomUUID();
const TEST_SPACE_ID = randomUUID();
const TEST_PROJECT_ID = randomUUID();
const TEST_USER_ID = randomUUID();

// モックリポジトリの作成
const createMockReviewTargetRepository = (): IReviewTargetRepository => ({
  findById: vi.fn(),
  findByReviewSpaceId: vi.fn(),
  countByReviewSpaceId: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
});

const createMockReviewResultRepository = (): IReviewResultRepository => ({
  findById: vi.fn(),
  findByReviewTargetId: vi.fn(),
  countByReviewTargetId: vi.fn(),
  save: vi.fn(),
  saveMany: vi.fn(),
  delete: vi.fn(),
  deleteByReviewTargetId: vi.fn(),
});

const createMockCheckListItemRepository = (): ICheckListItemRepository => ({
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
});

const createMockReviewDocumentCacheRepository = (): IReviewDocumentCacheRepository => ({
  findById: vi.fn(),
  findByReviewTargetId: vi.fn(),
  save: vi.fn(),
  saveMany: vi.fn(),
  deleteByReviewTargetId: vi.fn(),
});

const createMockReviewSpaceRepository = (): IReviewSpaceRepository => ({
  findById: vi.fn(),
  findByProjectId: vi.fn(),
  countByProjectId: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
});

const createMockProjectRepository = (): IProjectRepository => ({
  findById: vi.fn(),
  findByMemberId: vi.fn(),
  countByMemberId: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
});

describe("GetRetryInfoService", () => {
  let service: GetRetryInfoService;
  let mockReviewTargetRepository: IReviewTargetRepository;
  let mockReviewResultRepository: IReviewResultRepository;
  let mockCheckListItemRepository: ICheckListItemRepository;
  let mockReviewDocumentCacheRepository: IReviewDocumentCacheRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;

  // テスト用のレビュースペースとプロジェクト
  const testReviewSpace = ReviewSpace.reconstruct({
    id: TEST_SPACE_ID,
    projectId: TEST_PROJECT_ID,
    name: "テストスペース",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const testProject = Project.reconstruct({
    id: TEST_PROJECT_ID,
    name: "テストプロジェクト",
    description: null,
    encryptedApiKey: null,
    members: [{ userId: TEST_USER_ID, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockReviewTargetRepository = createMockReviewTargetRepository();
    mockReviewResultRepository = createMockReviewResultRepository();
    mockCheckListItemRepository = createMockCheckListItemRepository();
    mockReviewDocumentCacheRepository = createMockReviewDocumentCacheRepository();
    mockReviewSpaceRepository = createMockReviewSpaceRepository();
    mockProjectRepository = createMockProjectRepository();

    service = new GetRetryInfoService(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockCheckListItemRepository,
      mockReviewDocumentCacheRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );

    // デフォルトのモック設定（アクセス権を持つ）
    vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(testReviewSpace);
    vi.mocked(mockProjectRepository.findById).mockResolvedValue(testProject);
  });

  const createCompletedReviewTarget = (options?: {
    reviewType?: string;
    reviewSettings?: object | null;
  }) => {
    return ReviewTarget.reconstruct({
      id: TEST_TARGET_ID,
      reviewSpaceId: TEST_SPACE_ID,
      name: "テストレビュー対象",
      status: "completed",
      reviewType: options?.reviewType ?? "small",
      reviewSettings: options?.reviewSettings !== undefined
        ? options.reviewSettings
        : {
            additionalInstructions: "追加指示",
            concurrentReviewItems: 5,
            commentFormat: null,
            evaluationCriteria: [{ label: "A", description: "良好" }],
          },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const createReviewResult = (options: {
    checkListItemContent: string;
    evaluation?: string | null;
    comment?: string | null;
    errorMessage?: string | null;
  }) => {
    if (options.errorMessage) {
      return ReviewResult.reconstruct({
        id: randomUUID(),
        reviewTargetId: TEST_TARGET_ID,
        checkListItemContent: options.checkListItemContent,
        evaluation: null,
        comment: null,
        errorMessage: options.errorMessage,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return ReviewResult.reconstruct({
      id: randomUUID(),
      reviewTargetId: TEST_TARGET_ID,
      checkListItemContent: options.checkListItemContent,
      evaluation: options.evaluation ?? "A",
      comment: options.comment ?? "コメント",
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const createDocumentCache = (options: {
    fileName: string;
    processMode: "text" | "image";
    cachePath?: string | null;
  }) => {
    return ReviewDocumentCache.reconstruct({
      id: randomUUID(),
      reviewTargetId: TEST_TARGET_ID,
      fileName: options.fileName,
      processMode: options.processMode,
      // undefinedの場合はデフォルト値、nullの場合はnullを設定
      cachePath: options.cachePath === undefined ? "/cache/path" : options.cachePath,
      createdAt: new Date(),
    });
  };

  const createCheckListItem = (content: string) => {
    return CheckListItem.reconstruct({
      id: randomUUID(),
      reviewSpaceId: TEST_SPACE_ID,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  describe("execute", () => {
    it("完了状態のレビュー対象のリトライ情報を正しく返す", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget();
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
        createReviewResult({ checkListItemContent: "項目2" }),
      ];
      const checkListItems = [
        createCheckListItem("項目1"),
        createCheckListItem("項目2"),
      ];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.canRetry).toBe(true);
      expect(result.reviewType).toBe("small");
      expect(result.previousSettings).not.toBeNull();
      expect(result.failedItemCount).toBe(0);
      expect(result.totalItemCount).toBe(2);
      expect(result.hasChecklistDiff).toBe(false);
      expect(result.snapshotChecklistCount).toBe(2);
      expect(result.currentChecklistCount).toBe(2);
      expect(result.hasCachedDocuments).toBe(true);
    });

    it("失敗項目がある場合、failedItemCountを正しくカウントする", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget();
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
        createReviewResult({ checkListItemContent: "項目2", errorMessage: "エラー1" }),
        createReviewResult({ checkListItemContent: "項目3", errorMessage: "エラー2" }),
      ];
      const checkListItems = [
        createCheckListItem("項目1"),
        createCheckListItem("項目2"),
        createCheckListItem("項目3"),
      ];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.failedItemCount).toBe(2);
      expect(result.totalItemCount).toBe(3);
    });

    it("チェックリストが変更された場合、hasChecklistDiffがtrueになる", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget();
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
        createReviewResult({ checkListItemContent: "項目2" }),
      ];
      // 現在のチェックリストは3項目（項目3が追加された）
      const checkListItems = [
        createCheckListItem("項目1"),
        createCheckListItem("項目2"),
        createCheckListItem("項目3"),
      ];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.hasChecklistDiff).toBe(true);
      expect(result.snapshotChecklistCount).toBe(2);
      expect(result.currentChecklistCount).toBe(3);
    });

    it("キャッシュがない場合、hasCachedDocumentsがfalseになる", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget();
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
      ];
      const checkListItems = [createCheckListItem("項目1")];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue([]);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.hasCachedDocuments).toBe(false);
      expect(result.canRetry).toBe(false); // キャッシュがないのでリトライ不可
    });

    it("キャッシュパスがnullの場合、hasCachedDocumentsがfalseになる", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget();
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
      ];
      const checkListItems = [createCheckListItem("項目1")];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text", cachePath: null }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.hasCachedDocuments).toBe(false);
      expect(result.canRetry).toBe(false);
    });

    it("レビュー中の場合、canRetryがfalseになる", async () => {
      // Arrange
      const reviewTarget = ReviewTarget.reconstruct({
        id: TEST_TARGET_ID,
        reviewSpaceId: TEST_SPACE_ID,
        name: "テストレビュー対象",
        status: "reviewing",
        reviewType: "small",
        reviewSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const reviewResults: ReviewResult[] = [];
      const checkListItems: CheckListItem[] = [];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.canRetry).toBe(false);
    });

    it("レビュー対象が存在しない場合、エラーを返す", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      const command: GetRetryInfoCommand = {
        reviewTargetId: randomUUID(), // 存在しないID
        userId: TEST_USER_ID,
      };

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow();
    });

    it("レビュー設定がnullの場合、previousSettingsがnullになる", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget({ reviewSettings: null });
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
      ];
      const checkListItems = [createCheckListItem("項目1")];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.previousSettings).toBeNull();
    });

    it("大量レビューの場合、reviewTypeがlargeになる", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget({ reviewType: "large" });
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
      ];
      const checkListItems = [createCheckListItem("項目1")];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.reviewType).toBe("large");
    });

    it("error状態のレビュー対象でもリトライ情報を取得できる（キャッシュ有）", async () => {
      // Arrange
      const reviewTarget = ReviewTarget.reconstruct({
        id: TEST_TARGET_ID,
        reviewSpaceId: TEST_SPACE_ID,
        name: "テストレビュー対象",
        status: "error",
        reviewType: "small",
        reviewSettings: {
          additionalInstructions: "追加指示",
          concurrentReviewItems: 5,
          commentFormat: null,
          evaluationCriteria: [{ label: "A", description: "良好" }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1", errorMessage: "エラー発生" }),
      ];
      const checkListItems = [createCheckListItem("項目1")];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.canRetry).toBe(true);
      expect(result.failedItemCount).toBe(1);
    });

    it("pending状態のレビュー対象はcanRetryがfalseになる", async () => {
      // Arrange
      const reviewTarget = ReviewTarget.reconstruct({
        id: TEST_TARGET_ID,
        reviewSpaceId: TEST_SPACE_ID,
        name: "テストレビュー対象",
        status: "pending",
        reviewType: null,
        reviewSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const reviewResults: ReviewResult[] = [];
      const checkListItems: CheckListItem[] = [];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.canRetry).toBe(false);
    });

    it("複数キャッシュのうち一部がnullパスの場合、hasCachedDocuments=falseになる", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget();
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
      ];
      const checkListItems = [createCheckListItem("項目1")];
      // 1つ目は有効、2つ目は無効（パスがnull）
      const documentCaches = [
        createDocumentCache({ fileName: "test1.txt", processMode: "text" }),
        createDocumentCache({ fileName: "test2.txt", processMode: "text", cachePath: null }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.hasCachedDocuments).toBe(false);
      expect(result.canRetry).toBe(false);
    });

    it("チェックリスト項目数が同じでも内容が異なる場合、hasChecklistDiff=trueになる", async () => {
      // Arrange
      const reviewTarget = createCompletedReviewTarget();
      // スナップショット: 項目1, 項目2
      const reviewResults = [
        createReviewResult({ checkListItemContent: "項目1" }),
        createReviewResult({ checkListItemContent: "項目2" }),
      ];
      // 現在のチェックリスト: 項目1, 項目3（数は同じだが内容が異なる）
      const checkListItems = [
        createCheckListItem("項目1"),
        createCheckListItem("項目3"),
      ];
      const documentCaches = [
        createDocumentCache({ fileName: "test.txt", processMode: "text" }),
      ];

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(reviewTarget);
      vi.mocked(mockReviewResultRepository.findByReviewTargetId).mockResolvedValue(reviewResults);
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue(checkListItems);
      vi.mocked(mockReviewDocumentCacheRepository.findByReviewTargetId).mockResolvedValue(documentCaches);

      const command: GetRetryInfoCommand = {
        reviewTargetId: TEST_TARGET_ID,
        userId: TEST_USER_ID,
      };

      // Act
      const result = await service.execute(command);

      // Assert
      expect(result.hasChecklistDiff).toBe(true);
      expect(result.snapshotChecklistCount).toBe(2);
      expect(result.currentChecklistCount).toBe(2);
    });
  });
});
