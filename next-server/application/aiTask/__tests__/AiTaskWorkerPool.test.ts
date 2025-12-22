import { describe, it, expect, beforeEach, vi } from "vitest";
import { AiTaskWorkerPool } from "../AiTaskWorkerPool";
import { AiTaskQueueService } from "../AiTaskQueueService";
import { AiTaskExecutor } from "../AiTaskExecutor";
import { AiTaskWorker } from "../AiTaskWorker";

// isRunningの状態を制御するためのフラグ
let mockIsRunning = true;

// AiTaskWorkerをモック
vi.mock("../AiTaskWorker", () => {
  return {
    AiTaskWorker: vi.fn().mockImplementation(() => ({
      get isRunning() {
        return mockIsRunning;
      },
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("AiTaskWorkerPool", () => {
  let mockQueueService: AiTaskQueueService;
  let mockExecutor: AiTaskExecutor;
  let workerPool: AiTaskWorkerPool;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRunning = true; // デフォルトは実行中

    // モックの作成
    mockQueueService = {} as AiTaskQueueService;
    mockExecutor = {} as AiTaskExecutor;

    workerPool = new AiTaskWorkerPool(mockQueueService, mockExecutor);
  });

  describe("hasWorkers", () => {
    it("ワーカーが存在しない場合はfalseを返す", () => {
      // Act & Assert
      expect(workerPool.hasWorkers("test-api-key-hash")).toBe(false);
    });

    it("実行中のワーカーが存在する場合はtrueを返す", async () => {
      // Arrange
      mockIsRunning = true;
      await workerPool.startWorkers("test-api-key-hash");

      // Act & Assert
      expect(workerPool.hasWorkers("test-api-key-hash")).toBe(true);
    });

    it("全てのワーカーが停止している場合はfalseを返す", async () => {
      // Arrange - まず実行中状態でワーカーを作成
      mockIsRunning = true;
      await workerPool.startWorkers("test-api-key-hash");

      // ワーカーの状態を停止に変更
      mockIsRunning = false;

      // Act & Assert
      expect(workerPool.hasWorkers("test-api-key-hash")).toBe(false);
    });
  });

  describe("startWorkers", () => {
    it("新しいAPIキーハッシュに対してワーカーを開始できる", async () => {
      // Arrange
      const apiKeyHash = "new-api-key-hash";
      mockIsRunning = true;

      // Act
      await workerPool.startWorkers(apiKeyHash);

      // Assert
      expect(workerPool.hasWorkers(apiKeyHash)).toBe(true);
      expect(workerPool.getManagedApiKeyHashes()).toContain(apiKeyHash);
    });

    it("既に実行中のワーカーがある場合は新しいワーカーを開始しない", async () => {
      // Arrange
      const apiKeyHash = "existing-api-key-hash";
      mockIsRunning = true;
      await workerPool.startWorkers(apiKeyHash);

      // ワーカーコンストラクタの呼び出し回数を記録
      const MockedAiTaskWorker = vi.mocked(AiTaskWorker);
      const initialCallCount = MockedAiTaskWorker.mock.calls.length;

      // Act - 再度同じAPIキーハッシュでstartWorkersを呼ぶ
      await workerPool.startWorkers(apiKeyHash);

      // Assert - 新しいワーカーは作成されない
      expect(MockedAiTaskWorker.mock.calls.length).toBe(initialCallCount);
    });

    it("停止済みワーカーがある場合はhasWorkersがfalseを返し、再度startWorkersを呼ぶと新しいワーカーが開始される", async () => {
      // このテストは、ワーカーが停止状態になった後に
      // startWorkersを呼ぶと新しいワーカーが開始されることを確認する
      // 実装の詳細（クリーンアップロジック）ではなく、振る舞いをテストする

      // Arrange: 新しいワーカープールを作成
      const apiKeyHash = "stopped-workers-hash";

      // 最初は実行中状態でワーカーを作成
      mockIsRunning = true;
      const workerPool2 = new AiTaskWorkerPool(mockQueueService, mockExecutor);
      await workerPool2.startWorkers(apiKeyHash);

      // 実行中のワーカーがある
      expect(workerPool2.hasWorkers(apiKeyHash)).toBe(true);
      expect(workerPool2.getManagedApiKeyHashes()).toContain(apiKeyHash);

      // ワーカーを停止状態に変更
      mockIsRunning = false;

      // hasWorkersはfalseを返す（停止済み）
      expect(workerPool2.hasWorkers(apiKeyHash)).toBe(false);

      // 実行中状態に戻す
      mockIsRunning = true;

      // Act: 再度startWorkersを呼ぶ（内部でクリーンアップが行われる）
      await workerPool2.startWorkers(apiKeyHash);

      // Assert: ワーカーが開始された状態
      expect(workerPool2.hasWorkers(apiKeyHash)).toBe(true);
    });
  });

  describe("stopWorkers", () => {
    it("指定したAPIキーハッシュのワーカーを停止できる", async () => {
      // Arrange
      const apiKeyHash = "stop-test-hash";
      await workerPool.startWorkers(apiKeyHash);
      expect(workerPool.hasWorkers(apiKeyHash)).toBe(true);

      // Act
      await workerPool.stopWorkers(apiKeyHash);

      // Assert
      expect(workerPool.getManagedApiKeyHashes()).not.toContain(apiKeyHash);
    });

    it("存在しないAPIキーハッシュに対しては何もしない", async () => {
      // Act & Assert - エラーが発生しないことを確認
      await expect(
        workerPool.stopWorkers("non-existent-hash"),
      ).resolves.toBeUndefined();
    });
  });

  describe("stopAllWorkers", () => {
    it("全てのワーカーを停止できる", async () => {
      // Arrange
      await workerPool.startWorkers("hash-1");
      await workerPool.startWorkers("hash-2");
      expect(workerPool.getManagedApiKeyHashes().length).toBe(2);

      // Act
      await workerPool.stopAllWorkers();

      // Assert
      expect(workerPool.getManagedApiKeyHashes().length).toBe(0);
    });
  });

  describe("getRunningWorkerCount", () => {
    it("実行中のワーカー数を正しく返す", async () => {
      // Arrange
      await workerPool.startWorkers("hash-1");

      // Act & Assert
      expect(workerPool.getRunningWorkerCount()).toBeGreaterThan(0);
    });

    it("ワーカーがない場合は0を返す", () => {
      // Act & Assert
      expect(workerPool.getRunningWorkerCount()).toBe(0);
    });
  });
});
