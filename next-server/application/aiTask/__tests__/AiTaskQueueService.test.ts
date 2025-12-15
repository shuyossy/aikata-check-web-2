import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AiTaskQueueService,
  type EnqueueTaskCommand,
  type CompleteTaskCommand,
  type FailTaskCommand,
} from "../AiTaskQueueService";
import type { IAiTaskRepository } from "@/application/shared/port/repository/IAiTaskRepository";
import type { IAiTaskFileMetadataRepository } from "@/application/shared/port/repository/IAiTaskFileMetadataRepository";
import { AiTask, AI_TASK_STATUS } from "@/domain/aiTask";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";

// TaskFileHelperのモック
vi.mock("@/lib/server/taskFileHelper", () => ({
  TaskFileHelper: {
    saveFile: vi.fn().mockResolvedValue("/path/to/file"),
    saveConvertedImages: vi.fn().mockResolvedValue(undefined),
    getConvertedImagePath: vi.fn().mockReturnValue("/path/to/image_0.png"),
    deleteTaskFiles: vi.fn().mockResolvedValue(undefined),
  },
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

describe("AiTaskQueueService", () => {
  // モックリポジトリ
  const mockAiTaskRepository: IAiTaskRepository = {
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findByApiKeyHashAndStatus: vi.fn(),
    findDistinctApiKeyHashesInQueue: vi.fn(),
    countQueuedByApiKeyHash: vi.fn(),
    dequeueNextTask: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    deleteByStatus: vi.fn(),
    findByReviewTargetId: vi.fn(),
    deleteByReviewTargetId: vi.fn(),
    findChecklistGenerationTaskByReviewSpaceId: vi.fn(),
    deleteChecklistGenerationTaskByReviewSpaceId: vi.fn(),
  };

  const mockAiTaskFileMetadataRepository: IAiTaskFileMetadataRepository = {
    findByTaskId: vi.fn(),
    save: vi.fn(),
    deleteByTaskId: vi.fn(),
  };

  let service: AiTaskQueueService;

  const now = new Date();
  const testTaskId = "550e8400-e29b-41d4-a716-446655440001";
  const testApiKeyHash = "test-api-key-hash-12345678901234567890123456789012";

  const createTestAiTask = (status: string = AI_TASK_STATUS.QUEUED) =>
    AiTask.reconstruct({
      id: testTaskId,
      taskType: "small_review",
      status,
      apiKeyHash: testApiKeyHash,
      priority: 5,
      payload: { reviewTargetId: "test-review-target-id" },
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      fileMetadata: [],
    });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiTaskQueueService(
      mockAiTaskRepository,
      mockAiTaskFileMetadataRepository,
    );
  });

  describe("enqueueTask", () => {
    it("テキストモードでタスクをキューに登録できる", async () => {
      // モックの設定
      vi.mocked(mockAiTaskRepository.save).mockResolvedValue(undefined);
      vi.mocked(mockAiTaskRepository.countQueuedByApiKeyHash).mockResolvedValue(1);

      const command: EnqueueTaskCommand = {
        taskType: "small_review",
        apiKey: "sk-test-api-key",
        payload: { reviewTargetId: "test-review-target" },
        priority: 5,
        files: [
          {
            fileId: "file-id-1",
            fileName: "test.txt",
            fileSize: 1024,
            mimeType: "text/plain",
            processMode: "text",
            buffer: Buffer.from("test content"),
          },
        ],
      };

      const result = await service.enqueueTask(command);

      // 結果の検証
      expect(result.taskId).toBeDefined();
      expect(result.apiKeyHash).toBeDefined();
      expect(result.apiKeyHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256ハッシュ形式
      expect(result.queueLength).toBe(1);

      // リポジトリのsaveが呼ばれたことを検証
      expect(mockAiTaskRepository.save).toHaveBeenCalledTimes(1);

      // ファイル保存が呼ばれたことを検証
      expect(TaskFileHelper.saveFile).toHaveBeenCalledTimes(1);
    });

    it("画像モードでタスクをキューに登録できる", async () => {
      // モックの設定
      vi.mocked(mockAiTaskRepository.save).mockResolvedValue(undefined);
      vi.mocked(mockAiTaskRepository.countQueuedByApiKeyHash).mockResolvedValue(1);

      const command: EnqueueTaskCommand = {
        taskType: "large_review",
        apiKey: "sk-test-api-key",
        payload: { reviewTargetId: "test-review-target" },
        files: [
          {
            fileId: "file-id-1",
            fileName: "document.pdf",
            fileSize: 2048,
            mimeType: "application/pdf",
            processMode: "image",
            buffer: Buffer.alloc(0), // 画像モードでは空のバッファ
            convertedImageBuffers: [
              Buffer.from("image1"),
              Buffer.from("image2"),
            ],
          },
        ],
      };

      const result = await service.enqueueTask(command);

      // 結果の検証
      expect(result.taskId).toBeDefined();
      expect(result.apiKeyHash).toBeDefined();
      expect(result.queueLength).toBe(1);

      // 画像保存が呼ばれたことを検証
      expect(TaskFileHelper.saveConvertedImages).toHaveBeenCalledTimes(1);
    });

    it("ファイルなしでタスクをキューに登録できる", async () => {
      // モックの設定
      vi.mocked(mockAiTaskRepository.save).mockResolvedValue(undefined);
      vi.mocked(mockAiTaskRepository.countQueuedByApiKeyHash).mockResolvedValue(1);

      const command: EnqueueTaskCommand = {
        taskType: "checklist_generation",
        apiKey: "sk-test-api-key",
        payload: { reviewSpaceId: "test-space" },
      };

      const result = await service.enqueueTask(command);

      expect(result.taskId).toBeDefined();
      expect(result.apiKeyHash).toBeDefined();
      expect(result.queueLength).toBe(1);
      expect(TaskFileHelper.saveFile).not.toHaveBeenCalled();
      expect(TaskFileHelper.saveConvertedImages).not.toHaveBeenCalled();
    });
  });

  describe("dequeueTask", () => {
    it("キューからタスクを取得できる", async () => {
      const testTask = createTestAiTask(AI_TASK_STATUS.PROCESSING);
      vi.mocked(mockAiTaskRepository.dequeueNextTask).mockResolvedValue(testTask);

      const result = await service.dequeueTask(testApiKeyHash);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testTaskId);
      expect(mockAiTaskRepository.dequeueNextTask).toHaveBeenCalledWith(
        testApiKeyHash,
      );
    });

    it("キューが空の場合はnullを返す", async () => {
      vi.mocked(mockAiTaskRepository.dequeueNextTask).mockResolvedValue(null);

      const result = await service.dequeueTask(testApiKeyHash);

      expect(result).toBeNull();
    });
  });

  describe("completeTask", () => {
    it("タスクを完了としてマークし、クリーンアップされる", async () => {
      const testTask = createTestAiTask(AI_TASK_STATUS.PROCESSING);
      vi.mocked(mockAiTaskRepository.findById).mockResolvedValue(testTask);

      const command: CompleteTaskCommand = {
        taskId: testTaskId,
      };

      await service.completeTask(command);

      // ファイル削除が呼ばれたことを検証
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(testTaskId);

      // DB削除が呼ばれたことを検証
      expect(mockAiTaskRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("タスクが存在しない場合は何もしない", async () => {
      vi.mocked(mockAiTaskRepository.findById).mockResolvedValue(null);

      const command: CompleteTaskCommand = {
        taskId: testTaskId,
      };

      // エラーが発生しないことを確認
      await expect(service.completeTask(command)).resolves.toBeUndefined();

      // 削除処理が呼ばれないことを確認
      expect(TaskFileHelper.deleteTaskFiles).not.toHaveBeenCalled();
      expect(mockAiTaskRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("failTask", () => {
    it("タスクを失敗としてマークし、クリーンアップされる", async () => {
      const testTask = createTestAiTask(AI_TASK_STATUS.PROCESSING);
      vi.mocked(mockAiTaskRepository.findById).mockResolvedValue(testTask);

      const command: FailTaskCommand = {
        taskId: testTaskId,
        errorMessage: "テストエラー",
      };

      await service.failTask(command);

      // ファイル削除が呼ばれたことを検証
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(testTaskId);

      // DB削除が呼ばれたことを検証
      expect(mockAiTaskRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("タスクが存在しない場合は何もしない", async () => {
      vi.mocked(mockAiTaskRepository.findById).mockResolvedValue(null);

      const command: FailTaskCommand = {
        taskId: testTaskId,
        errorMessage: "テストエラー",
      };

      // エラーが発生しないことを確認
      await expect(service.failTask(command)).resolves.toBeUndefined();

      // 削除処理が呼ばれないことを確認
      expect(TaskFileHelper.deleteTaskFiles).not.toHaveBeenCalled();
      expect(mockAiTaskRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("getQueueLength", () => {
    it("キュー長を取得できる", async () => {
      vi.mocked(mockAiTaskRepository.countQueuedByApiKeyHash).mockResolvedValue(5);

      const result = await service.getQueueLength(testApiKeyHash);

      expect(result).toBe(5);
      expect(mockAiTaskRepository.countQueuedByApiKeyHash).toHaveBeenCalledWith(
        testApiKeyHash,
      );
    });
  });

  describe("findById", () => {
    it("タスクをIDで取得できる", async () => {
      const testTask = createTestAiTask();
      vi.mocked(mockAiTaskRepository.findById).mockResolvedValue(testTask);

      const result = await service.findById(testTaskId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testTaskId);
    });

    it("タスクが存在しない場合はnullを返す", async () => {
      vi.mocked(mockAiTaskRepository.findById).mockResolvedValue(null);

      const result = await service.findById(testTaskId);

      expect(result).toBeNull();
    });
  });

  describe("findDistinctApiKeyHashesInQueue", () => {
    it("キューにあるユニークなAPIキーハッシュ一覧を取得できる", async () => {
      const apiKeyHashes = ["hash1", "hash2", "hash3"];
      vi.mocked(
        mockAiTaskRepository.findDistinctApiKeyHashesInQueue,
      ).mockResolvedValue(apiKeyHashes);

      const result = await service.findDistinctApiKeyHashesInQueue();

      expect(result).toEqual(apiKeyHashes);
    });
  });

  describe("findProcessingTasks", () => {
    it("処理中のタスク一覧を取得できる", async () => {
      const tasks = [
        createTestAiTask(AI_TASK_STATUS.PROCESSING),
        createTestAiTask(AI_TASK_STATUS.PROCESSING),
      ];
      vi.mocked(mockAiTaskRepository.findByStatus).mockResolvedValue(tasks);

      const result = await service.findProcessingTasks();

      expect(result).toHaveLength(2);
      expect(mockAiTaskRepository.findByStatus).toHaveBeenCalledWith(
        AI_TASK_STATUS.PROCESSING,
      );
    });
  });
});
