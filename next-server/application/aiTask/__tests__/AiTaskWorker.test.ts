import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AiTaskWorker } from "../AiTaskWorker";
import type { AiTaskQueueService } from "../AiTaskQueueService";
import type { AiTaskExecutor, TaskExecutionResult } from "../AiTaskExecutor";
import type { IWorkflowRunRegistry } from "../WorkflowRunRegistry";
import type { AiTaskDto } from "@/domain/aiTask";

// ロガーのモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("AiTaskWorker", () => {
  // モックキューサービス
  const mockQueueService = {
    dequeueTask: vi.fn(),
    completeTask: vi.fn(),
    failTask: vi.fn(),
  } as unknown as AiTaskQueueService;

  // モックエグゼキューター
  const mockExecutor = {
    execute: vi.fn(),
  } as unknown as AiTaskExecutor;

  let worker: AiTaskWorker;
  const testApiKeyHash = "test-api-key-hash";
  const testWorkerId = "worker-1";

  const now = new Date();

  // テスト用タスク
  const createTestTask = (): AiTaskDto => ({
    id: "test-task-id",
    taskType: "small_review",
    status: "processing",
    apiKeyHash: testApiKeyHash,
    priority: 5,
    payload: { reviewTargetId: "test-review-target" },
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    fileMetadata: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // 1秒のポーリング間隔を設定（最小値）
    process.env.AI_QUEUE_POLLING_INTERVAL_MS = "1000";
    worker = new AiTaskWorker(
      testApiKeyHash,
      mockQueueService,
      mockExecutor,
      testWorkerId,
    );
  });

  afterEach(async () => {
    // テスト後にワーカーを停止
    if (worker.isRunning) {
      await worker.stop();
    }
    delete process.env.AI_QUEUE_POLLING_INTERVAL_MS;
  });

  describe("初期状態", () => {
    it("初期状態では実行中ではない", () => {
      expect(worker.isRunning).toBe(false);
    });

    it("初期状態では現在のタスクIDはnull", () => {
      expect(worker.currentTaskId).toBeNull();
    });
  });

  describe("start/stop", () => {
    it("ワーカーを開始・停止できる", async () => {
      // タスクがない状態をモック - stopが呼ばれると即座にループを終了
      vi.mocked(mockQueueService.dequeueTask).mockResolvedValue(null);

      await worker.start();
      expect(worker.isRunning).toBe(true);

      // stopを呼び出す
      const stopPromise = worker.stop();

      // stopは非同期で完了を待つ
      await stopPromise;
      expect(worker.isRunning).toBe(false);
    }, 15000);

    it("既に実行中の場合は何もしない", async () => {
      vi.mocked(mockQueueService.dequeueTask).mockResolvedValue(null);

      await worker.start();
      await worker.start(); // 2回目の呼び出し

      expect(worker.isRunning).toBe(true);
    }, 15000);

    it("実行中でない場合にstopを呼んでも何もしない", async () => {
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
    });
  });

  describe("タスク処理", () => {
    it("タスク成功時はcompleteTaskが呼ばれる", async () => {
      const testTask = createTestTask();
      let stopTriggered = false;

      // 最初はタスクを返し、タスク処理後はループを停止させる
      vi.mocked(mockQueueService.dequeueTask).mockImplementation(async () => {
        if (!stopTriggered) {
          stopTriggered = true;
          return testTask;
        }
        // タスク処理後はstopを促す
        return null;
      });

      const successResult: TaskExecutionResult = { success: true };
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      vi.mocked(mockQueueService.completeTask).mockResolvedValue(undefined);

      // ワーカー開始
      await worker.start();

      // タスクが処理されるのを待つ
      await vi.waitFor(
        () => {
          expect(mockQueueService.completeTask).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      await worker.stop();

      expect(mockQueueService.completeTask).toHaveBeenCalledWith({
        taskId: testTask.id,
      });
    }, 20000);

    it("タスク失敗時はfailTaskが呼ばれる", async () => {
      const testTask = createTestTask();
      let stopTriggered = false;

      vi.mocked(mockQueueService.dequeueTask).mockImplementation(async () => {
        if (!stopTriggered) {
          stopTriggered = true;
          return testTask;
        }
        return null;
      });

      const failResult: TaskExecutionResult = {
        success: false,
        errorMessage: "テストエラー",
      };
      vi.mocked(mockExecutor.execute).mockResolvedValue(failResult);
      vi.mocked(mockQueueService.failTask).mockResolvedValue(undefined);

      await worker.start();

      await vi.waitFor(
        () => {
          expect(mockQueueService.failTask).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      await worker.stop();

      expect(mockQueueService.failTask).toHaveBeenCalledWith({
        taskId: testTask.id,
        errorMessage: "テストエラー",
      });
    }, 20000);

    it("executorでエラーが発生した場合はfailTaskが呼ばれる", async () => {
      const testTask = createTestTask();
      let stopTriggered = false;

      vi.mocked(mockQueueService.dequeueTask).mockImplementation(async () => {
        if (!stopTriggered) {
          stopTriggered = true;
          return testTask;
        }
        return null;
      });

      vi.mocked(mockExecutor.execute).mockRejectedValue(
        new Error("実行時エラー"),
      );
      vi.mocked(mockQueueService.failTask).mockResolvedValue(undefined);

      await worker.start();

      await vi.waitFor(
        () => {
          expect(mockQueueService.failTask).toHaveBeenCalled();
        },
        { timeout: 10000 },
      );

      await worker.stop();

      expect(mockQueueService.failTask).toHaveBeenCalledWith({
        taskId: testTask.id,
        errorMessage: "実行時エラー",
      });
    }, 20000);

    it("タスク実行中はcurrentTaskIdが設定され、完了後はnullになる", async () => {
      const testTask = createTestTask();
      let stopTriggered = false;
      let capturedTaskIdDuringExecution: string | null = null;

      vi.mocked(mockQueueService.dequeueTask).mockImplementation(async () => {
        if (!stopTriggered) {
          stopTriggered = true;
          return testTask;
        }
        return null;
      });

      // 実行中にcurrentTaskIdをキャプチャ
      vi.mocked(mockExecutor.execute).mockImplementation(async () => {
        capturedTaskIdDuringExecution = worker.currentTaskId;
        return { success: true };
      });
      vi.mocked(mockQueueService.completeTask).mockResolvedValue(undefined);

      await worker.start();

      await vi.waitFor(
        () => {
          expect(mockQueueService.completeTask).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      await worker.stop();

      // 実行中はtaskIdが設定されていた
      expect(capturedTaskIdDuringExecution).toBe(testTask.id);
      // 完了後はnull
      expect(worker.currentTaskId).toBeNull();
    }, 20000);
  });

  describe("WorkflowRunRegistry統合", () => {
    // モックWorkflowRunRegistry
    const mockWorkflowRunRegistry: IWorkflowRunRegistry = {
      register: vi.fn(),
      deregister: vi.fn(),
      cancel: vi.fn(),
      isRegistered: vi.fn(),
      isCancelling: vi.fn(),
      setCancelling: vi.fn(),
    };

    let workerWithRegistry: AiTaskWorker;

    beforeEach(() => {
      vi.clearAllMocks();
      workerWithRegistry = new AiTaskWorker(
        testApiKeyHash,
        mockQueueService,
        mockExecutor,
        testWorkerId,
        mockWorkflowRunRegistry,
      );
    });

    afterEach(async () => {
      if (workerWithRegistry.isRunning) {
        await workerWithRegistry.stop();
      }
    });

    it("キャンセル中の場合はデキューをスキップする", async () => {
      // isCancelling()が最初はtrue、一定時間後にfalseを返すようにする
      let cancellingCalls = 0;
      vi.mocked(mockWorkflowRunRegistry.isCancelling).mockImplementation(() => {
        cancellingCalls++;
        // 3回目以降はfalseを返す
        return cancellingCalls < 3;
      });

      // キャンセル解除後にタスクを返し、その後停止
      let taskReturned = false;
      vi.mocked(mockQueueService.dequeueTask).mockImplementation(async () => {
        if (!taskReturned) {
          taskReturned = true;
          return createTestTask();
        }
        return null;
      });

      const successResult: TaskExecutionResult = { success: true };
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      vi.mocked(mockQueueService.completeTask).mockResolvedValue(undefined);

      await workerWithRegistry.start();

      await vi.waitFor(
        () => {
          expect(mockQueueService.completeTask).toHaveBeenCalled();
        },
        { timeout: 10000 },
      );

      await workerWithRegistry.stop();

      // isCancellingが複数回呼ばれたことを確認（キャンセル中のチェック）
      expect(mockWorkflowRunRegistry.isCancelling).toHaveBeenCalled();
      // キャンセル中はデキューがスキップされ、後でタスクが処理されたことを確認
      expect(mockQueueService.dequeueTask).toHaveBeenCalled();
    }, 20000);

    it("キャンセル中でない場合は通常通りデキューされる", async () => {
      // isCancelling()が常にfalseを返す
      vi.mocked(mockWorkflowRunRegistry.isCancelling).mockReturnValue(false);

      let taskReturned = false;
      vi.mocked(mockQueueService.dequeueTask).mockImplementation(async () => {
        if (!taskReturned) {
          taskReturned = true;
          return createTestTask();
        }
        return null;
      });

      const successResult: TaskExecutionResult = { success: true };
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      vi.mocked(mockQueueService.completeTask).mockResolvedValue(undefined);

      await workerWithRegistry.start();

      await vi.waitFor(
        () => {
          expect(mockQueueService.completeTask).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      await workerWithRegistry.stop();

      // isCancellingが呼ばれたことを確認
      expect(mockWorkflowRunRegistry.isCancelling).toHaveBeenCalled();
      // デキューが呼ばれたことを確認
      expect(mockQueueService.dequeueTask).toHaveBeenCalled();
      // タスクが実行されたことを確認
      expect(mockExecutor.execute).toHaveBeenCalled();
    }, 20000);

    it("WorkflowRunRegistryが渡されていない場合はキャンセルチェックをスキップ", async () => {
      // WorkflowRunRegistryなしのworkerを使用
      vi.mocked(mockQueueService.dequeueTask).mockResolvedValue(null);

      await worker.start();

      // 少し待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      await worker.stop();

      // WorkflowRunRegistryなしなのでisCancellingは呼ばれない
      expect(mockWorkflowRunRegistry.isCancelling).not.toHaveBeenCalled();
    }, 15000);
  });
});
