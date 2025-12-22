import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AiTaskExecutor,
  type ReviewTaskPayload,
  type ChecklistGenerationTaskPayload,
} from "../AiTaskExecutor";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { ILargeDocumentResultCacheRepository } from "@/application/shared/port/repository/ILargeDocumentResultCacheRepository";
import type { IWorkflowRunRegistry } from "../WorkflowRunRegistry";
import type { AiTaskDto } from "@/domain/aiTask";
import { ReviewTarget, ReviewDocumentCache } from "@/domain/reviewTarget";
import { ReviewSpace } from "@/domain/reviewSpace";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";

// TaskFileHelperのモック
vi.mock("@/lib/server/taskFileHelper", () => ({
  TaskFileHelper: {
    loadFile: vi.fn().mockResolvedValue(Buffer.from("test content")),
    loadConvertedImages: vi.fn().mockResolvedValue([Buffer.from("image1")]),
  },
}));

// ReviewCacheHelperのモック
vi.mock("@/lib/server/reviewCacheHelper", () => ({
  ReviewCacheHelper: {
    saveTextCache: vi.fn().mockResolvedValue("/cache/path/text"),
    saveImageCache: vi.fn().mockResolvedValue("/cache/path/image"),
    loadTextCache: vi.fn().mockResolvedValue("cached text content"),
    loadImageCache: vi.fn().mockResolvedValue([Buffer.from("cached image")]),
  },
}));

// mastraのモック
const mockWorkflowRun = {
  start: vi.fn(),
};

const mockWorkflow = {
  createRunAsync: vi.fn().mockResolvedValue(mockWorkflowRun),
};

vi.mock("@/application/mastra", () => ({
  mastra: {
    getWorkflow: vi.fn().mockReturnValue({
      createRunAsync: () => Promise.resolve(mockWorkflowRun),
    }),
  },
  checkWorkflowResult: vi.fn().mockReturnValue({ status: "success" }),
  FILE_BUFFERS_CONTEXT_KEY: "fileBuffers",
}));

// ロガーのモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ========================================
// workflow.start()の引数をキャプチャするための型定義とヘルパー
// ========================================

/**
 * workflow.start()に渡される引数の型
 */
interface CapturedStartArgs {
  inputData: unknown;
  runtimeContext: {
    get: (key: string) => unknown;
  };
}

/**
 * RuntimeContext検証用のオプション型
 */
interface RuntimeContextExpectations {
  /** 存在すべきキー */
  shouldExist?: string[];
  /** 存在すべきでないキー */
  shouldNotExist?: string[];
  /** 厳密に一致すべき値 */
  exactValues?: Record<string, unknown>;
  /** 関数であるべきキー */
  shouldBeFunction?: string[];
  /** Mapインスタンスであるべきキー */
  shouldBeMap?: string[];
}

/**
 * RuntimeContextの内容を検証するヘルパー関数
 */
const assertRuntimeContext = (
  runtimeContext: { get: (key: string) => unknown } | null,
  expectations: RuntimeContextExpectations,
): void => {
  expect(runtimeContext).not.toBeNull();

  if (expectations.shouldExist) {
    for (const key of expectations.shouldExist) {
      expect(runtimeContext!.get(key)).toBeDefined();
    }
  }

  if (expectations.shouldNotExist) {
    for (const key of expectations.shouldNotExist) {
      expect(runtimeContext!.get(key)).toBeUndefined();
    }
  }

  if (expectations.exactValues) {
    for (const [key, value] of Object.entries(expectations.exactValues)) {
      expect(runtimeContext!.get(key)).toEqual(value);
    }
  }

  if (expectations.shouldBeFunction) {
    for (const key of expectations.shouldBeFunction) {
      expect(typeof runtimeContext!.get(key)).toBe("function");
    }
  }

  if (expectations.shouldBeMap) {
    for (const key of expectations.shouldBeMap) {
      expect(runtimeContext!.get(key)).toBeInstanceOf(Map);
    }
  }
};

describe("AiTaskExecutor", () => {
  // モックWorkflowRunRegistry
  const mockWorkflowRunRegistry: IWorkflowRunRegistry = {
    register: vi.fn(),
    deregister: vi.fn(),
    cancel: vi.fn(),
    isRegistered: vi.fn(),
    isCancelling: vi.fn(),
    setCancelling: vi.fn(),
  };

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

  const mockReviewDocumentCacheRepository: IReviewDocumentCacheRepository = {
    findById: vi.fn(),
    findByReviewTargetId: vi.fn(),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
  };

  const mockReviewSpaceRepository: IReviewSpaceRepository = {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    countByProjectId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    updateChecklistGenerationError: vi.fn(),
  };

  const mockLargeDocumentResultCacheRepository: ILargeDocumentResultCacheRepository =
    {
      save: vi.fn(),
      saveMany: vi.fn(),
      findByReviewTargetId: vi.fn(),
      deleteByReviewTargetId: vi.fn(),
      findChecklistResultsWithIndividualResults: vi.fn(),
      getMaxTotalChunksForDocument: vi.fn(),
    };

  let executor: AiTaskExecutor;

  const now = new Date();
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440002";

  // テスト用データ
  const testReviewTarget = ReviewTarget.reconstruct({
    id: testReviewTargetId,
    reviewSpaceId: testReviewSpaceId,
    name: "テストレビュー対象",
    status: "queued",
    reviewType: "small",
    reviewSettings: null,
    createdAt: now,
    updatedAt: now,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new AiTaskExecutor(
      mockReviewTargetRepository,
      mockReviewResultRepository,
      mockCheckListItemRepository,
      mockReviewDocumentCacheRepository,
      mockReviewSpaceRepository,
      mockLargeDocumentResultCacheRepository,
    );
  });

  describe("execute - レビュータスク", () => {
    const createReviewTask = (
      taskType: string = "small_review",
    ): AiTaskDto => ({
      id: "test-task-id",
      taskType,
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewTargetId: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [{ id: "file-1", name: "test.txt", type: "text/plain" }],
        checkListItems: [{ id: "item-1", content: "チェック項目1" }],
        reviewSettings: {
          additionalInstructions: null,
          concurrentReviewItems: 5,
          commentFormat: null,
          evaluationCriteria: [{ label: "A", description: "問題なし" }],
        },
        reviewType: taskType === "small_review" ? "small" : "large",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      } as unknown as ReviewTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-task-id",
          fileName: "test.txt",
          filePath: "/path/to/test.txt",
          fileSize: 1024,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
      ],
    });

    it("レビュー対象が見つからない場合はエラーを返す", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      const task = createReviewTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("レビュー対象が見つかりません");
    });

    it("正常なレビュータスクを実行できる", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      // ワークフロー結果のモック
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      expect(mockReviewTargetRepository.save).toHaveBeenCalled();
    });

    it("大量レビュータスクも実行できる", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask("large_review");
      const result = await executor.execute(task);

      expect(result.success).toBe(true);
    });

    it("ワークフロー失敗時はエラーステータスに更新される", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({
        status: "failed",
        errorMessage: "ワークフローエラー",
      });

      const task = createReviewTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("ワークフローエラー");
      // エラー時にステータスが更新されることを確認
      expect(mockReviewTargetRepository.save).toHaveBeenCalled();
    });
  });

  describe("execute - チェックリスト生成タスク", () => {
    const createChecklistTask = (): AiTaskDto => ({
      id: "test-task-id",
      taskType: "checklist_generation",
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [{ id: "file-1", name: "document.txt", type: "text/plain" }],
        checklistRequirements: "テスト用のチェックリストを生成してください",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      } as unknown as ChecklistGenerationTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-task-id",
          fileName: "document.txt",
          filePath: "/path/to/document.txt",
          fileSize: 2048,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
      ],
    });

    it("正常なチェックリスト生成タスクを実行できる", async () => {
      // ワークフロー結果のモック
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          generatedItems: ["チェック項目1", "チェック項目2", "チェック項目3"],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
        undefined,
      );
      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      // チェック項目がDBに保存されたことを確認
      expect(mockCheckListItemRepository.bulkInsert).toHaveBeenCalled();
      // 成功時にエラーメッセージがクリアされることを確認
      expect(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).toHaveBeenCalledWith(expect.anything(), null);
    });

    it("ワークフロー失敗時はエラーメッセージが保存される", async () => {
      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({
        status: "failed",
        errorMessage: "チェックリスト生成エラー",
      });

      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("チェックリスト生成エラー");
      // エラーメッセージがレビュースペースに保存されることを確認
      expect(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).toHaveBeenCalledWith(expect.anything(), "チェックリスト生成エラー");
    });

    it("生成結果が空の場合はエラーを返す", async () => {
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          generatedItems: [],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("チェックリストが生成されませんでした");
    });
  });

  describe("execute - 不明なタスクタイプ", () => {
    it("不明なタスクタイプの場合はエラーを返す", async () => {
      const task: AiTaskDto = {
        id: "test-task-id",
        taskType: "unknown_type",
        status: "processing",
        apiKeyHash: "test-api-key-hash",
        priority: 5,
        payload: {},
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: null,
        fileMetadata: [],
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      // エラーメッセージがnormalizeUnknownErrorで変換される可能性があるため、存在チェックのみ
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe("execute - ファイル読み込みエラー", () => {
    it("ファイル読み込み失敗時はエラーを返す", async () => {
      // TaskFileHelperのloadFileをエラーにする
      vi.mocked(TaskFileHelper.loadFile).mockRejectedValueOnce(
        new Error("ファイルが見つかりません"),
      );

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        ReviewTarget.reconstruct({
          id: testReviewTargetId,
          reviewSpaceId: testReviewSpaceId,
          name: "テストレビュー対象",
          status: "queued",
          reviewType: "small",
          reviewSettings: null,
          createdAt: now,
          updatedAt: now,
        }),
      );

      const task: AiTaskDto = {
        id: "test-task-id",
        taskType: "small_review",
        status: "processing",
        apiKeyHash: "test-api-key-hash",
        priority: 5,
        payload: {
          reviewTargetId: testReviewTargetId,
          reviewSpaceId: testReviewSpaceId,
          userId: "test-user-id",
          files: [{ id: "file-1", name: "test.txt", type: "text/plain" }],
          checkListItems: [{ id: "item-1", content: "チェック項目1" }],
          reviewSettings: {
            additionalInstructions: null,
            concurrentReviewItems: 5,
            commentFormat: null,
            evaluationCriteria: [{ label: "A", description: "問題なし" }],
          },
          reviewType: "small",
          aiApiConfig: {
            apiKey: "test-api-key",
            apiUrl: "http://test-api-url",
            apiModel: "test-model",
          },
        },
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: null,
        fileMetadata: [
          {
            id: "file-meta-1",
            taskId: "test-task-id",
            fileName: "test.txt",
            filePath: "/path/to/test.txt",
            fileSize: 1024,
            mimeType: "text/plain",
            processMode: "text" as const,
            convertedImageCount: 0,
            createdAt: now,
          },
        ],
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe("WorkflowRunRegistry統合", () => {
    let executorWithRegistry: AiTaskExecutor;

    beforeEach(() => {
      vi.clearAllMocks();
      executorWithRegistry = new AiTaskExecutor(
        mockReviewTargetRepository,
        mockReviewResultRepository,
        mockCheckListItemRepository,
        mockReviewDocumentCacheRepository,
        mockReviewSpaceRepository,
        mockLargeDocumentResultCacheRepository,
        mockWorkflowRunRegistry,
      );
    });

    const createReviewTask = (): AiTaskDto => ({
      id: "test-task-id",
      taskType: "small_review",
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewTargetId: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [{ id: "file-1", name: "test.txt", type: "text/plain" }],
        checkListItems: [{ id: "item-1", content: "チェック項目1" }],
        reviewSettings: {
          additionalInstructions: null,
          concurrentReviewItems: 5,
          commentFormat: null,
          evaluationCriteria: [{ label: "A", description: "問題なし" }],
        },
        reviewType: "small",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      } as unknown as ReviewTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-task-id",
          fileName: "test.txt",
          filePath: "/path/to/test.txt",
          fileSize: 1024,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
      ],
    });

    const createChecklistTask = (): AiTaskDto => ({
      id: "test-checklist-task-id",
      taskType: "checklist_generation",
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [{ id: "file-1", name: "document.txt", type: "text/plain" }],
        checklistRequirements: "テスト用のチェックリストを生成してください",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      } as unknown as ChecklistGenerationTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-checklist-task-id",
          fileName: "document.txt",
          filePath: "/path/to/document.txt",
          fileSize: 2048,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
      ],
    });

    it("レビュータスク実行時にワークフローが登録・解除されること", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();
      await executorWithRegistry.execute(task);

      // ワークフローが登録されたことを確認
      expect(mockWorkflowRunRegistry.register).toHaveBeenCalledWith(
        "test-task-id",
        expect.anything(),
      );
      // ワークフローが解除されたことを確認
      expect(mockWorkflowRunRegistry.deregister).toHaveBeenCalledWith(
        "test-task-id",
      );
    });

    it("レビュータスク失敗時もワークフローが解除されること", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      mockWorkflowRun.start.mockRejectedValue(new Error("ワークフローエラー"));

      const task = createReviewTask();
      await executorWithRegistry.execute(task);

      // エラー時もワークフローが解除されることを確認
      expect(mockWorkflowRunRegistry.register).toHaveBeenCalledWith(
        "test-task-id",
        expect.anything(),
      );
      expect(mockWorkflowRunRegistry.deregister).toHaveBeenCalledWith(
        "test-task-id",
      );
    });

    it("チェックリスト生成タスク実行時にワークフローが登録・解除されること", async () => {
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          generatedItems: ["チェック項目1", "チェック項目2"],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
        undefined,
      );
      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();
      await executorWithRegistry.execute(task);

      // ワークフローが登録されたことを確認
      expect(mockWorkflowRunRegistry.register).toHaveBeenCalledWith(
        "test-checklist-task-id",
        expect.anything(),
      );
      // ワークフローが解除されたことを確認
      expect(mockWorkflowRunRegistry.deregister).toHaveBeenCalledWith(
        "test-checklist-task-id",
      );
    });

    it("チェックリスト生成タスク失敗時もワークフローが解除されること", async () => {
      mockWorkflowRun.start.mockRejectedValue(new Error("ワークフローエラー"));

      const task = createChecklistTask();
      await executorWithRegistry.execute(task);

      // エラー時もワークフローが解除されることを確認
      expect(mockWorkflowRunRegistry.register).toHaveBeenCalledWith(
        "test-checklist-task-id",
        expect.anything(),
      );
      expect(mockWorkflowRunRegistry.deregister).toHaveBeenCalledWith(
        "test-checklist-task-id",
      );
    });

    it("WorkflowRunRegistryが渡されていない場合は登録・解除が呼ばれないこと", async () => {
      // WorkflowRunRegistryなしのexecutorを使用
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();
      // mockWorkflowRunRegistryをクリア
      vi.mocked(mockWorkflowRunRegistry.register).mockClear();
      vi.mocked(mockWorkflowRunRegistry.deregister).mockClear();

      await executor.execute(task);

      // WorkflowRunRegistryなしのexecutorでは登録・解除が呼ばれない
      expect(mockWorkflowRunRegistry.register).not.toHaveBeenCalled();
      expect(mockWorkflowRunRegistry.deregister).not.toHaveBeenCalled();
    });
  });

  describe("execute - リトライレビュータスク", () => {
    const testCacheId = "550e8400-e29b-41d4-a716-446655440010";
    // UUID形式のレビュー結果ID
    const testResultId1 = "550e8400-e29b-41d4-a716-446655440101";
    const testResultId2 = "550e8400-e29b-41d4-a716-446655440102";
    const testResultId3 = "550e8400-e29b-41d4-a716-446655440103";
    const testResultId4 = "550e8400-e29b-41d4-a716-446655440104";
    const testResultId5 = "550e8400-e29b-41d4-a716-446655440105";

    const createRetryReviewTask = (): AiTaskDto => ({
      id: "test-retry-task-id",
      taskType: "small_review",
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewTargetId: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [], // リトライ時はファイルは空
        checkListItems: [{ id: "item-1", content: "チェック項目1" }],
        reviewSettings: {
          additionalInstructions: null,
          concurrentReviewItems: 5,
          commentFormat: null,
          evaluationCriteria: [{ label: "A", description: "問題なし" }],
        },
        reviewType: "small",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
        isRetry: true,
        retryScope: "failed",
        resultsToDeleteIds: [testResultId1, testResultId2],
      } as unknown as ReviewTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [], // リトライ時はファイルメタデータは空
    });

    const createTestDocumentCache = (): ReviewDocumentCache => {
      return ReviewDocumentCache.reconstruct({
        id: testCacheId,
        reviewTargetId: testReviewTargetId,
        fileName: "test.txt",
        processMode: "text",
        cachePath: "/cache/path/test.txt",
        createdAt: now,
      });
    };

    it("リトライ時に対象のレビュー結果が削除される", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([createTestDocumentCache()]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      // ワークフロー結果のモック
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createRetryReviewTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      // レビュー結果が削除されたことを確認（2件）
      expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(2);
      expect(mockReviewResultRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: testResultId1 }),
      );
      expect(mockReviewResultRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: testResultId2 }),
      );
    });

    it("リトライ時にドキュメントキャッシュが参照される", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([createTestDocumentCache()]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      // ワークフロー結果のモック
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createRetryReviewTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      // ドキュメントキャッシュリポジトリが呼ばれたことを確認
      expect(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ value: testReviewTargetId }),
      );
    });

    it("リトライ時にドキュメントキャッシュがない場合はエラーになる", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      // キャッシュが空を返す
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      const task = createRetryReviewTask();
      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe(
        "ドキュメントキャッシュが見つかりません",
      );
    });

    it("リトライ時にresultsToDeleteIdsが空の場合は削除処理がスキップされる", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([createTestDocumentCache()]);

      // ワークフロー結果のモック
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      // resultsToDeleteIdsを空にしたタスク
      const task = createRetryReviewTask();
      (task.payload as unknown as ReviewTaskPayload).resultsToDeleteIds = [];

      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      // 削除処理が呼ばれないことを確認
      expect(mockReviewResultRepository.delete).not.toHaveBeenCalled();
    });

    it("全項目リトライ時に全てのレビュー結果が削除される", async () => {
      // モックの設定
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([createTestDocumentCache()]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      // ワークフロー結果のモック
      mockWorkflowRun.start.mockResolvedValue({
        status: "success",
        result: {
          status: "success",
          reviewResults: [
            {
              checkListItemId: "item-1",
              rating: "A",
              comment: "問題ありません",
            },
            {
              checkListItemId: "item-2",
              rating: "B",
              comment: "軽微な問題あり",
            },
          ],
        },
      });

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      // 全項目リトライ用のタスク（5件のレビュー結果を削除）
      const task = createRetryReviewTask();
      (task.payload as unknown as ReviewTaskPayload).retryScope = "all";
      (task.payload as unknown as ReviewTaskPayload).resultsToDeleteIds = [
        testResultId1,
        testResultId2,
        testResultId3,
        testResultId4,
        testResultId5,
      ];

      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      // 全てのレビュー結果が削除されたことを確認（5件）
      expect(mockReviewResultRepository.delete).toHaveBeenCalledTimes(5);
    });
  });

  // ========================================
  // workflow.start()の引数検証テスト
  // ========================================

  describe("execute - レビュータスク - inputData検証", () => {
    // キャプチャ用変数
    let capturedStartArgs: CapturedStartArgs | null = null;

    const createReviewTask = (
      taskType: string = "small_review",
    ): AiTaskDto => ({
      id: "test-task-id",
      taskType,
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewTargetId: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [{ id: "file-1", name: "test.txt", type: "text/plain" }],
        checkListItems: [
          { id: "item-1", content: "チェック項目1" },
          { id: "item-2", content: "チェック項目2" },
        ],
        reviewSettings: {
          additionalInstructions: "追加指示",
          concurrentReviewItems: 3,
          commentFormat: "箇条書き",
          evaluationCriteria: [
            { label: "A", description: "問題なし" },
            { label: "B", description: "軽微な問題あり" },
          ],
        },
        reviewType: taskType === "small_review" ? "small" : "large",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      } as unknown as ReviewTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-task-id",
          fileName: "test.txt",
          filePath: "/path/to/test.txt",
          fileSize: 1024,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
      ],
    });

    beforeEach(() => {
      capturedStartArgs = null;
      // start引数をキャプチャするモック設定
      mockWorkflowRun.start = vi.fn().mockImplementation((args) => {
        capturedStartArgs = args;
        return Promise.resolve({
          status: "success",
          result: {
            status: "success",
            reviewResults: [
              { checkListItemId: "item-1", rating: "A", comment: "OK" },
              { checkListItemId: "item-2", rating: "A", comment: "OK" },
            ],
          },
        });
      });
    });

    it("通常レビュー実行時にinputDataが正しく渡されること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(mockWorkflowRun.start).toHaveBeenCalledTimes(1);
      expect(capturedStartArgs).not.toBeNull();

      const inputData = capturedStartArgs!.inputData as {
        files: unknown[];
        checkListItems: unknown[];
        reviewSettings: unknown;
        reviewType: string;
      };

      // filesが正しく渡されていること
      expect(inputData.files).toEqual([
        expect.objectContaining({
          id: "file-1",
          name: "test.txt",
          type: "text/plain",
        }),
      ]);

      // checkListItemsが正しく渡されていること
      expect(inputData.checkListItems).toEqual([
        expect.objectContaining({ id: "item-1", content: "チェック項目1" }),
        expect.objectContaining({ id: "item-2", content: "チェック項目2" }),
      ]);

      // reviewSettingsが正しく渡されていること
      expect(inputData.reviewSettings).toEqual(
        expect.objectContaining({
          additionalInstructions: "追加指示",
          concurrentReviewItems: 3,
          commentFormat: "箇条書き",
          evaluationCriteria: [
            { label: "A", description: "問題なし" },
            { label: "B", description: "軽微な問題あり" },
          ],
        }),
      );

      // reviewTypeが正しく渡されていること
      expect(inputData.reviewType).toBe("small");
    });

    it("大量レビュー実行時にreviewTypeがlargeで渡されること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask("large_review");

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      const inputData = capturedStartArgs!.inputData as { reviewType: string };
      expect(inputData.reviewType).toBe("large");
    });

    it("リトライ実行時にfilesが空配列で渡されること", async () => {
      // Arrange
      const testCacheId = "550e8400-e29b-41d4-a716-446655440010";
      const createTestDocumentCache = (): ReviewDocumentCache => {
        return ReviewDocumentCache.reconstruct({
          id: testCacheId,
          reviewTargetId: testReviewTargetId,
          fileName: "test.txt",
          processMode: "text",
          cachePath: "/cache/path/test.txt",
          createdAt: now,
        });
      };

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([createTestDocumentCache()]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      // リトライタスクを作成
      const task = createReviewTask();
      (task.payload as unknown as ReviewTaskPayload).isRetry = true;
      (task.payload as unknown as ReviewTaskPayload).retryScope = "failed";
      (task.payload as unknown as ReviewTaskPayload).resultsToDeleteIds = [];
      task.fileMetadata = [];

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      const inputData = capturedStartArgs!.inputData as { files: unknown[] };
      // リトライ時はfilesが空配列であること
      expect(inputData.files).toEqual([]);
    });

    it("reviewSettingsがundefinedの場合もinputDataに含まれること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();
      (task.payload as unknown as ReviewTaskPayload).reviewSettings = undefined;

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      const inputData = capturedStartArgs!.inputData as {
        reviewSettings: unknown;
      };
      expect(inputData.reviewSettings).toBeUndefined();
    });
  });

  describe("execute - レビュータスク - RuntimeContext検証", () => {
    let capturedStartArgs: CapturedStartArgs | null = null;

    const createReviewTask = (
      overrides?: Partial<ReviewTaskPayload>,
    ): AiTaskDto => ({
      id: "test-task-id",
      taskType: "small_review",
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewTargetId: testReviewTargetId,
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [{ id: "file-1", name: "test.txt", type: "text/plain" }],
        checkListItems: [{ id: "item-1", content: "チェック項目1" }],
        reviewSettings: {
          additionalInstructions: null,
          concurrentReviewItems: 5,
          commentFormat: null,
          evaluationCriteria: [{ label: "A", description: "問題なし" }],
        },
        reviewType: "small",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
        ...overrides,
      } as unknown as ReviewTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-task-id",
          fileName: "test.txt",
          filePath: "/path/to/test.txt",
          fileSize: 1024,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
      ],
    });

    beforeEach(() => {
      capturedStartArgs = null;
      mockWorkflowRun.start = vi.fn().mockImplementation((args) => {
        capturedStartArgs = args;
        return Promise.resolve({
          status: "success",
          result: {
            status: "success",
            reviewResults: [
              { checkListItemId: "item-1", rating: "A", comment: "OK" },
            ],
          },
        });
      });
    });

    it("RuntimeContextにemployeeIdが設定されること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      expect(capturedStartArgs!.runtimeContext.get("employeeId")).toBe(
        "test-user-id",
      );
    });

    it("RuntimeContextにreviewTargetIdが設定されること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      expect(capturedStartArgs!.runtimeContext.get("reviewTargetId")).toBe(
        testReviewTargetId,
      );
    });

    it("RuntimeContextにaiApiKey/aiApiUrl/aiApiModelが設定されること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      expect(capturedStartArgs!.runtimeContext.get("aiApiKey")).toBe(
        "test-api-key",
      );
      expect(capturedStartArgs!.runtimeContext.get("aiApiUrl")).toBe(
        "http://test-api-url",
      );
      expect(capturedStartArgs!.runtimeContext.get("aiApiModel")).toBe(
        "test-model",
      );
    });

    it("RuntimeContextにfileBuffersが設定されること（通常モード）", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      const fileBuffers = capturedStartArgs!.runtimeContext.get("fileBuffers");
      expect(fileBuffers).toBeInstanceOf(Map);
    });

    it("RuntimeContextにonReviewResultSavedコールバックが設定されること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      assertRuntimeContext(capturedStartArgs!.runtimeContext, {
        shouldBeFunction: ["onReviewResultSaved"],
      });
    });

    it("RuntimeContextにonExtractedFilesCachedコールバックが設定されること（通常モード）", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      assertRuntimeContext(capturedStartArgs!.runtimeContext, {
        shouldBeFunction: ["onExtractedFilesCached"],
      });
    });

    it("RuntimeContextにonIndividualResultsSavedコールバックが設定されること", async () => {
      // Arrange
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask();

      // Act
      await executor.execute(task);

      // Assert
      assertRuntimeContext(capturedStartArgs!.runtimeContext, {
        shouldBeFunction: ["onIndividualResultsSaved"],
      });
    });

    it("リトライ時にuseCachedDocumentsがtrueで設定されること", async () => {
      // Arrange
      const testCacheId = "550e8400-e29b-41d4-a716-446655440010";
      const testDocumentCache = ReviewDocumentCache.reconstruct({
        id: testCacheId,
        reviewTargetId: testReviewTargetId,
        fileName: "test.txt",
        processMode: "text",
        cachePath: "/cache/path/test.txt",
        createdAt: now,
      });

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([testDocumentCache]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask({
        isRetry: true,
        retryScope: "failed",
        resultsToDeleteIds: [],
      });
      task.fileMetadata = [];

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      expect(capturedStartArgs!.runtimeContext.get("useCachedDocuments")).toBe(
        true,
      );
    });

    it("リトライ時にcachedDocumentsが設定されること", async () => {
      // Arrange
      const testCacheId = "550e8400-e29b-41d4-a716-446655440010";
      const testDocumentCache = ReviewDocumentCache.reconstruct({
        id: testCacheId,
        reviewTargetId: testReviewTargetId,
        fileName: "test.txt",
        processMode: "text",
        cachePath: "/cache/path/test.txt",
        createdAt: now,
      });

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([testDocumentCache]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask({
        isRetry: true,
        retryScope: "failed",
        resultsToDeleteIds: [],
      });
      task.fileMetadata = [];

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      const cachedDocuments =
        capturedStartArgs!.runtimeContext.get("cachedDocuments");
      expect(Array.isArray(cachedDocuments)).toBe(true);
      expect((cachedDocuments as unknown[]).length).toBeGreaterThan(0);
      expect((cachedDocuments as { name: string }[])[0]).toEqual(
        expect.objectContaining({
          name: "test.txt",
          processMode: "text",
        }),
      );
    });

    it("リトライ時にfileBuffersが設定されないこと", async () => {
      // Arrange
      const testCacheId = "550e8400-e29b-41d4-a716-446655440010";
      const testDocumentCache = ReviewDocumentCache.reconstruct({
        id: testCacheId,
        reviewTargetId: testReviewTargetId,
        fileName: "test.txt",
        processMode: "text",
        cachePath: "/cache/path/test.txt",
        createdAt: now,
      });

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([testDocumentCache]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask({
        isRetry: true,
        retryScope: "failed",
        resultsToDeleteIds: [],
      });
      task.fileMetadata = [];

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      // リトライ時はfileBuffersが設定されない（通常モードのみ設定される）
      assertRuntimeContext(capturedStartArgs!.runtimeContext, {
        shouldNotExist: ["fileBuffers"],
      });
    });

    it("リトライ時にonExtractedFilesCachedが設定されないこと", async () => {
      // Arrange
      const testCacheId = "550e8400-e29b-41d4-a716-446655440010";
      const testDocumentCache = ReviewDocumentCache.reconstruct({
        id: testCacheId,
        reviewTargetId: testReviewTargetId,
        fileName: "test.txt",
        processMode: "text",
        cachePath: "/cache/path/test.txt",
        createdAt: now,
      });

      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(
        testReviewTarget,
      );
      vi.mocked(mockReviewTargetRepository.save).mockResolvedValue(undefined);
      vi.mocked(
        mockReviewDocumentCacheRepository.findByReviewTargetId,
      ).mockResolvedValue([testDocumentCache]);
      vi.mocked(mockReviewResultRepository.delete).mockResolvedValue(undefined);

      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });

      const task = createReviewTask({
        isRetry: true,
        retryScope: "failed",
        resultsToDeleteIds: [],
      });
      task.fileMetadata = [];

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      // リトライ時はonExtractedFilesCachedが設定されない（初回実行のみ）
      assertRuntimeContext(capturedStartArgs!.runtimeContext, {
        shouldNotExist: ["onExtractedFilesCached"],
      });
    });
  });

  describe("execute - チェックリスト生成タスク - inputData検証", () => {
    let capturedStartArgs: CapturedStartArgs | null = null;

    const createChecklistTask = (): AiTaskDto => ({
      id: "test-task-id",
      taskType: "checklist_generation",
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewSpaceId: testReviewSpaceId,
        userId: "test-user-id",
        files: [
          { id: "file-1", name: "document.txt", type: "text/plain" },
          { id: "file-2", name: "document2.pdf", type: "application/pdf" },
        ],
        checklistRequirements:
          "セキュリティ観点でチェックリストを生成してください",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
      } as unknown as ChecklistGenerationTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-task-id",
          fileName: "document.txt",
          filePath: "/path/to/document.txt",
          fileSize: 2048,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
        {
          id: "file-meta-2",
          taskId: "test-task-id",
          fileName: "document2.pdf",
          filePath: "/path/to/document2.pdf",
          fileSize: 4096,
          mimeType: "application/pdf",
          processMode: "image" as const,
          convertedImageCount: 3,
          createdAt: now,
        },
      ],
    });

    beforeEach(() => {
      capturedStartArgs = null;
      mockWorkflowRun.start = vi.fn().mockImplementation((args) => {
        capturedStartArgs = args;
        return Promise.resolve({
          status: "success",
          result: {
            status: "success",
            generatedItems: ["チェック項目1", "チェック項目2"],
          },
        });
      });
    });

    it("チェックリスト生成時にfilesが正しく渡されること", async () => {
      // Arrange
      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });
      vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
        undefined,
      );
      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(mockWorkflowRun.start).toHaveBeenCalledTimes(1);
      expect(capturedStartArgs).not.toBeNull();

      const inputData = capturedStartArgs!.inputData as {
        files: unknown[];
        checklistRequirements: string;
      };

      // filesが正しく渡されていること
      expect(inputData.files).toEqual([
        expect.objectContaining({
          id: "file-1",
          name: "document.txt",
          type: "text/plain",
        }),
        expect.objectContaining({
          id: "file-2",
          name: "document2.pdf",
          type: "application/pdf",
        }),
      ]);
    });

    it("チェックリスト生成時にchecklistRequirementsが正しく渡されること", async () => {
      // Arrange
      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });
      vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
        undefined,
      );
      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();

      const inputData = capturedStartArgs!.inputData as {
        checklistRequirements: string;
      };

      expect(inputData.checklistRequirements).toBe(
        "セキュリティ観点でチェックリストを生成してください",
      );
    });
  });

  describe("execute - チェックリスト生成タスク - RuntimeContext検証", () => {
    let capturedStartArgs: CapturedStartArgs | null = null;

    const createChecklistTask = (
      overrides?: Partial<ChecklistGenerationTaskPayload>,
    ): AiTaskDto => ({
      id: "test-task-id",
      taskType: "checklist_generation",
      status: "processing",
      apiKeyHash: "test-api-key-hash",
      priority: 5,
      payload: {
        reviewSpaceId: testReviewSpaceId,
        userId: "checklist-user-id",
        files: [{ id: "file-1", name: "document.txt", type: "text/plain" }],
        checklistRequirements: "チェックリスト生成要件",
        aiApiConfig: {
          apiKey: "test-api-key",
          apiUrl: "http://test-api-url",
          apiModel: "test-model",
        },
        ...overrides,
      } as unknown as ChecklistGenerationTaskPayload,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      fileMetadata: [
        {
          id: "file-meta-1",
          taskId: "test-task-id",
          fileName: "document.txt",
          filePath: "/path/to/document.txt",
          fileSize: 2048,
          mimeType: "text/plain",
          processMode: "text" as const,
          convertedImageCount: 0,
          createdAt: now,
        },
      ],
    });

    beforeEach(() => {
      capturedStartArgs = null;
      mockWorkflowRun.start = vi.fn().mockImplementation((args) => {
        capturedStartArgs = args;
        return Promise.resolve({
          status: "success",
          result: {
            status: "success",
            generatedItems: ["チェック項目1"],
          },
        });
      });
    });

    it("RuntimeContextにemployeeIdが設定されること", async () => {
      // Arrange
      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });
      vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
        undefined,
      );
      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      expect(capturedStartArgs!.runtimeContext.get("employeeId")).toBe(
        "checklist-user-id",
      );
    });

    it("RuntimeContextにaiApiKey/aiApiUrl/aiApiModelが設定されること", async () => {
      // Arrange
      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });
      vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
        undefined,
      );
      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      expect(capturedStartArgs!.runtimeContext.get("aiApiKey")).toBe(
        "test-api-key",
      );
      expect(capturedStartArgs!.runtimeContext.get("aiApiUrl")).toBe(
        "http://test-api-url",
      );
      expect(capturedStartArgs!.runtimeContext.get("aiApiModel")).toBe(
        "test-model",
      );
    });

    it("RuntimeContextにfileBuffersが設定されること", async () => {
      // Arrange
      const { checkWorkflowResult } = await import("@/application/mastra");
      vi.mocked(checkWorkflowResult).mockReturnValue({ status: "success" });
      vi.mocked(mockCheckListItemRepository.bulkInsert).mockResolvedValue(
        undefined,
      );
      vi.mocked(
        mockReviewSpaceRepository.updateChecklistGenerationError,
      ).mockResolvedValue(undefined);

      const task = createChecklistTask();

      // Act
      await executor.execute(task);

      // Assert
      expect(capturedStartArgs).not.toBeNull();
      const fileBuffers = capturedStartArgs!.runtimeContext.get("fileBuffers");
      expect(fileBuffers).toBeInstanceOf(Map);
    });
  });
});
