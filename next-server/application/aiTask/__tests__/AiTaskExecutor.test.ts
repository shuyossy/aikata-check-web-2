import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiTaskExecutor, type ReviewTaskPayload, type ChecklistGenerationTaskPayload } from "../AiTaskExecutor";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import type { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import type { IReviewDocumentCacheRepository } from "@/application/shared/port/repository/IReviewDocumentCacheRepository";
import type { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import type { ILargeDocumentResultCacheRepository } from "@/application/shared/port/repository/ILargeDocumentResultCacheRepository";
import type { ISystemSettingRepository } from "@/application/shared/port/repository/ISystemSettingRepository";
import type { IWorkflowRunRegistry } from "../WorkflowRunRegistry";
import type { AiTaskDto } from "@/domain/aiTask";
import { ReviewTarget } from "@/domain/reviewTarget";
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

  const mockLargeDocumentResultCacheRepository: ILargeDocumentResultCacheRepository = {
    save: vi.fn(),
    saveMany: vi.fn(),
    findByReviewTargetId: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
    findChecklistResultsWithIndividualResults: vi.fn(),
    getMaxTotalChunksForDocument: vi.fn(),
  };

  const mockSystemSettingRepository: ISystemSettingRepository = {
    find: vi.fn().mockResolvedValue(null),
    save: vi.fn(),
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
      mockSystemSettingRepository,
    );
  });

  describe("execute - レビュータスク", () => {
    const createReviewTask = (taskType: string = "small_review"): AiTaskDto => ({
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
        reviewType: "small_review",
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
          reviewType: "small_review",
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
        mockSystemSettingRepository,
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
        reviewType: "small_review",
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
});
