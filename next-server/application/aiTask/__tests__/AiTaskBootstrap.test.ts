import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AiTaskBootstrap, getAiTaskBootstrap } from "../AiTaskBootstrap";
import { AiTask, AI_TASK_TYPE, AI_TASK_STATUS } from "@/domain/aiTask";
import { ReviewTarget, REVIEW_TARGET_STATUS } from "@/domain/reviewTarget";

// モック用の関数参照を保持
let mockFindByStatus = vi.fn().mockResolvedValue([]);
let mockAiTaskDelete = vi.fn().mockResolvedValue(undefined);
let mockAiTaskSave = vi.fn().mockResolvedValue(undefined);
let mockReviewTargetFindById = vi.fn().mockResolvedValue(null);
let mockReviewTargetSave = vi.fn().mockResolvedValue(undefined);
let mockUpdateChecklistGenerationError = vi.fn().mockResolvedValue(undefined);

// 依存モジュールのモック
vi.mock("../AiTaskQueueService", () => {
  return {
    AiTaskQueueService: vi.fn().mockImplementation(() => ({
      findDistinctApiKeyHashesInQueue: vi.fn().mockResolvedValue([]),
    })),
  };
});

vi.mock("../AiTaskWorkerPool", () => {
  return {
    AiTaskWorkerPool: vi.fn().mockImplementation(() => ({
      startWorkers: vi.fn().mockResolvedValue(undefined),
      stopAllWorkers: vi.fn().mockResolvedValue(undefined),
      hasWorkers: vi.fn().mockReturnValue(false),
    })),
  };
});

vi.mock("../AiTaskExecutor", () => {
  return {
    AiTaskExecutor: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock("@/infrastructure/adapter/db/drizzle/repository", () => {
  return {
    AiTaskRepository: vi.fn().mockImplementation(() => ({
      findByStatus: (...args: unknown[]) => mockFindByStatus(...args),
      delete: (...args: unknown[]) => mockAiTaskDelete(...args),
      save: (...args: unknown[]) => mockAiTaskSave(...args),
    })),
    AiTaskFileMetadataRepository: vi.fn().mockImplementation(() => ({})),
    ReviewTargetRepository: vi.fn().mockImplementation(() => ({
      findById: (...args: unknown[]) => mockReviewTargetFindById(...args),
      save: (...args: unknown[]) => mockReviewTargetSave(...args),
    })),
    ReviewResultRepository: vi.fn().mockImplementation(() => ({})),
    CheckListItemRepository: vi.fn().mockImplementation(() => ({})),
    ReviewDocumentCacheRepository: vi.fn().mockImplementation(() => ({})),
    ReviewSpaceRepository: vi.fn().mockImplementation(() => ({
      updateChecklistGenerationError: (...args: unknown[]) =>
        mockUpdateChecklistGenerationError(...args),
    })),
    LargeDocumentResultCacheRepository: vi.fn().mockImplementation(() => ({})),
    SystemSettingRepository: vi.fn().mockImplementation(() => ({
      find: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    })),
  };
});

vi.mock("@/lib/server/taskFileHelper", () => {
  return {
    TaskFileHelper: {
      ensureBaseDir: vi.fn().mockResolvedValue(undefined),
      deleteTaskFiles: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe("AiTaskBootstrap", () => {
  let bootstrap: AiTaskBootstrap;

  beforeEach(() => {
    vi.clearAllMocks();

    // モック関数をリセット
    mockFindByStatus = vi.fn().mockResolvedValue([]);
    mockAiTaskDelete = vi.fn().mockResolvedValue(undefined);
    mockAiTaskSave = vi.fn().mockResolvedValue(undefined);
    mockReviewTargetFindById = vi.fn().mockResolvedValue(null);
    mockReviewTargetSave = vi.fn().mockResolvedValue(undefined);
    mockUpdateChecklistGenerationError = vi.fn().mockResolvedValue(undefined);

    // シングルトンインスタンスをリセット
    // プライベートフィールドにアクセスするためのワークアラウンド
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (AiTaskBootstrap as any).instance = null;

    bootstrap = getAiTaskBootstrap();
  });

  afterEach(async () => {
    // テスト後にシャットダウン
    if (bootstrap.getIsInitialized()) {
      await bootstrap.shutdown();
    }
  });

  describe("getAiTaskBootstrap", () => {
    it("シングルトンインスタンスを返す", () => {
      // Act
      const instance1 = getAiTaskBootstrap();
      const instance2 = getAiTaskBootstrap();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });

  describe("initialize", () => {
    it("初期化が正常に完了する", async () => {
      // Act
      await bootstrap.initialize();

      // Assert
      expect(bootstrap.getIsInitialized()).toBe(true);
      expect(bootstrap.getWorkerPool()).not.toBeNull();
      expect(bootstrap.getQueueService()).not.toBeNull();
    });

    it("既に初期化済みの場合は何もしない", async () => {
      // Arrange
      await bootstrap.initialize();
      const workerPool = bootstrap.getWorkerPool();

      // Act
      await bootstrap.initialize();

      // Assert
      expect(bootstrap.getWorkerPool()).toBe(workerPool);
    });
  });

  describe("startWorkersForApiKeyHash", () => {
    it("未初期化の場合は自動的に初期化を行う（遅延初期化）", async () => {
      // Arrange
      expect(bootstrap.getIsInitialized()).toBe(false);

      // Act
      await bootstrap.startWorkersForApiKeyHash("test-api-key-hash");

      // Assert
      expect(bootstrap.getIsInitialized()).toBe(true);
      expect(bootstrap.getWorkerPool()).not.toBeNull();
    });

    it("初期化済みの場合はワーカープールのstartWorkersを呼び出す", async () => {
      // Arrange
      await bootstrap.initialize();
      const workerPool = bootstrap.getWorkerPool();
      const apiKeyHash = "test-api-key-hash";

      // Act
      await bootstrap.startWorkersForApiKeyHash(apiKeyHash);

      // Assert
      expect(workerPool?.startWorkers).toHaveBeenCalledWith(apiKeyHash);
    });

    it("既にワーカーが存在する場合は新しいワーカーを開始しない", async () => {
      // Arrange
      await bootstrap.initialize();
      const workerPool = bootstrap.getWorkerPool();
      vi.mocked(workerPool!.hasWorkers).mockReturnValue(true);
      const apiKeyHash = "existing-api-key-hash";

      // Act
      await bootstrap.startWorkersForApiKeyHash(apiKeyHash);

      // Assert
      expect(workerPool?.startWorkers).not.toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    it("シャットダウン後は初期化状態がfalseになる", async () => {
      // Arrange
      await bootstrap.initialize();
      expect(bootstrap.getIsInitialized()).toBe(true);

      // Act
      await bootstrap.shutdown();

      // Assert
      expect(bootstrap.getIsInitialized()).toBe(false);
    });

    it("未初期化の場合は何もしない", async () => {
      // Arrange
      expect(bootstrap.getIsInitialized()).toBe(false);

      // Act & Assert - エラーが発生しないことを確認
      await expect(bootstrap.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("recoverStuckTasks", () => {
    const validReviewTargetId = "123e4567-e89b-12d3-a456-426614174001";
    const validReviewSpaceId = "223e4567-e89b-12d3-a456-426614174002";
    const validTaskId = "323e4567-e89b-12d3-a456-426614174003";

    // レビュータスク（processing状態）のモックデータを作成
    const createMockReviewTask = (taskType: string) =>
      AiTask.reconstruct({
        id: validTaskId,
        taskType: taskType,
        status: AI_TASK_STATUS.PROCESSING,
        apiKeyHash: "test_hash",
        priority: 5,
        payload: {
          reviewTargetId: validReviewTargetId,
          reviewSpaceId: validReviewSpaceId,
        },
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        fileMetadata: [],
      });

    // チェックリスト生成タスク（processing状態）のモックデータを作成
    const createMockChecklistGenerationTask = () =>
      AiTask.reconstruct({
        id: validTaskId,
        taskType: AI_TASK_TYPE.CHECKLIST_GENERATION,
        status: AI_TASK_STATUS.PROCESSING,
        apiKeyHash: "test_hash",
        priority: 5,
        payload: {
          reviewSpaceId: validReviewSpaceId,
        },
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        fileMetadata: [],
      });

    // reviewing状態のReviewTargetを作成
    const createMockReviewTarget = () =>
      ReviewTarget.reconstruct({
        id: validReviewTargetId,
        reviewSpaceId: validReviewSpaceId,
        name: "テストレビュー対象",
        status: REVIEW_TARGET_STATUS.REVIEWING,
        reviewSettings: null,
        reviewType: "small",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    describe("レビュータスク復元", () => {
      it("処理中のレビュータスク（small_review）がある場合、review_targetsのステータスをerrorに更新する", async () => {
        // Arrange
        const mockTask = createMockReviewTask(AI_TASK_TYPE.SMALL_REVIEW);
        const mockReviewTarget = createMockReviewTarget();
        mockFindByStatus.mockResolvedValue([mockTask]);
        mockReviewTargetFindById.mockResolvedValue(mockReviewTarget);

        // Act
        await bootstrap.initialize();

        // Assert
        // ReviewTargetRepository.findByIdが呼ばれたことを確認
        expect(mockReviewTargetFindById).toHaveBeenCalledWith(
          expect.objectContaining({ value: validReviewTargetId }),
        );
        // ReviewTargetRepository.saveが呼ばれ、ステータスがerrorになっていることを確認
        expect(mockReviewTargetSave).toHaveBeenCalled();
        const savedReviewTarget = mockReviewTargetSave.mock.calls[0][0];
        expect(savedReviewTarget.status.value).toBe(REVIEW_TARGET_STATUS.ERROR);
      });

      it("処理中のレビュータスク（large_review）がある場合、review_targetsのステータスをerrorに更新する", async () => {
        // Arrange
        const mockTask = createMockReviewTask(AI_TASK_TYPE.LARGE_REVIEW);
        const mockReviewTarget = createMockReviewTarget();
        mockFindByStatus.mockResolvedValue([mockTask]);
        mockReviewTargetFindById.mockResolvedValue(mockReviewTarget);

        // Act
        await bootstrap.initialize();

        // Assert
        expect(mockReviewTargetFindById).toHaveBeenCalledWith(
          expect.objectContaining({ value: validReviewTargetId }),
        );
        expect(mockReviewTargetSave).toHaveBeenCalled();
        const savedReviewTarget = mockReviewTargetSave.mock.calls[0][0];
        expect(savedReviewTarget.status.value).toBe(REVIEW_TARGET_STATUS.ERROR);
      });
    });

    describe("チェックリスト生成タスク復元", () => {
      it("処理中のチェックリスト生成タスクがある場合、checklistGenerationErrorを保存する", async () => {
        // Arrange
        const mockTask = createMockChecklistGenerationTask();
        mockFindByStatus.mockResolvedValue([mockTask]);

        // Act
        await bootstrap.initialize();

        // Assert
        expect(mockUpdateChecklistGenerationError).toHaveBeenCalledWith(
          expect.objectContaining({ value: validReviewSpaceId }),
          "システム再起動により処理が中断されました",
        );
      });
    });

    describe("エラーハンドリング", () => {
      it("ReviewTargetが見つからない場合、エラーをログに記録して処理を継続する", async () => {
        // Arrange
        const mockTask = createMockReviewTask(AI_TASK_TYPE.SMALL_REVIEW);
        mockFindByStatus.mockResolvedValue([mockTask]);
        mockReviewTargetFindById.mockResolvedValue(null);

        // Act & Assert - エラーなく初期化が完了すること
        await expect(bootstrap.initialize()).resolves.toBeUndefined();
        expect(bootstrap.getIsInitialized()).toBe(true);

        // ReviewTargetRepository.saveは呼ばれないこと
        expect(mockReviewTargetSave).not.toHaveBeenCalled();
        // タスク削除は行われること
        expect(mockAiTaskDelete).toHaveBeenCalled();
      });

      it("ReviewTargetのステータス更新に失敗した場合、エラーをログに記録して処理を継続する", async () => {
        // Arrange
        const mockTask = createMockReviewTask(AI_TASK_TYPE.SMALL_REVIEW);
        const mockReviewTarget = createMockReviewTarget();
        mockFindByStatus.mockResolvedValue([mockTask]);
        mockReviewTargetFindById.mockResolvedValue(mockReviewTarget);
        mockReviewTargetSave.mockRejectedValue(new Error("DB Error"));

        // Act & Assert - エラーなく初期化が完了すること
        await expect(bootstrap.initialize()).resolves.toBeUndefined();
        expect(bootstrap.getIsInitialized()).toBe(true);

        // タスク削除は行われること
        expect(mockAiTaskDelete).toHaveBeenCalled();
      });

      it("チェックリスト生成エラーの保存に失敗した場合、エラーをログに記録して処理を継続する", async () => {
        // Arrange
        const mockTask = createMockChecklistGenerationTask();
        mockFindByStatus.mockResolvedValue([mockTask]);
        mockUpdateChecklistGenerationError.mockRejectedValue(
          new Error("DB Error"),
        );

        // Act & Assert - エラーなく初期化が完了すること
        await expect(bootstrap.initialize()).resolves.toBeUndefined();
        expect(bootstrap.getIsInitialized()).toBe(true);

        // タスク削除は行われること
        expect(mockAiTaskDelete).toHaveBeenCalled();
      });
    });
  });
});
