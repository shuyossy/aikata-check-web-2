import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WorkflowRunRegistry,
  type CancellableWorkflowRun,
} from "../WorkflowRunRegistry";

// ロガーのモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("WorkflowRunRegistry", () => {
  let registry: WorkflowRunRegistry;

  beforeEach(() => {
    // 各テスト前にシングルトンをリセット
    WorkflowRunRegistry.resetInstance();
    registry = new WorkflowRunRegistry();
  });

  describe("シングルトンパターン", () => {
    it("getInstanceで同一インスタンスが返されること", () => {
      const instance1 = WorkflowRunRegistry.getInstance();
      const instance2 = WorkflowRunRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("resetInstanceでインスタンスがリセットされること", () => {
      const instance1 = WorkflowRunRegistry.getInstance();
      instance1.setCancelling(true);

      WorkflowRunRegistry.resetInstance();

      const instance2 = WorkflowRunRegistry.getInstance();
      expect(instance2.isCancelling()).toBe(false);
    });
  });

  describe("register/deregister", () => {
    it("ワークフロー実行を登録できること", () => {
      const mockRun: CancellableWorkflowRun = {
        cancel: vi.fn(),
      };

      registry.register("task-1", mockRun);

      expect(registry.isRegistered("task-1")).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it("複数のワークフロー実行を登録できること", () => {
      const mockRun1: CancellableWorkflowRun = { cancel: vi.fn() };
      const mockRun2: CancellableWorkflowRun = { cancel: vi.fn() };

      registry.register("task-1", mockRun1);
      registry.register("task-2", mockRun2);

      expect(registry.isRegistered("task-1")).toBe(true);
      expect(registry.isRegistered("task-2")).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it("ワークフロー実行の登録を解除できること", () => {
      const mockRun: CancellableWorkflowRun = { cancel: vi.fn() };
      registry.register("task-1", mockRun);

      registry.deregister("task-1");

      expect(registry.isRegistered("task-1")).toBe(false);
      expect(registry.size()).toBe(0);
    });

    it("存在しないタスクの登録解除をしてもエラーにならないこと", () => {
      expect(() => registry.deregister("non-existent")).not.toThrow();
    });
  });

  describe("cancel", () => {
    it("登録されているワークフローをキャンセルできること", async () => {
      const mockRun: CancellableWorkflowRun = {
        cancel: vi.fn().mockResolvedValue(undefined),
      };
      registry.register("task-1", mockRun);

      const result = await registry.cancel("task-1");

      expect(result).toBe(true);
      expect(mockRun.cancel).toHaveBeenCalledTimes(1);
      expect(registry.isRegistered("task-1")).toBe(false);
    });

    it("存在しないタスクのキャンセルはfalseを返すこと", async () => {
      const result = await registry.cancel("non-existent");

      expect(result).toBe(false);
    });

    it("キャンセル失敗時もfalseを返し、登録は解除されること", async () => {
      const mockRun: CancellableWorkflowRun = {
        cancel: vi.fn().mockRejectedValue(new Error("Cancel failed")),
      };
      registry.register("task-1", mockRun);

      const result = await registry.cancel("task-1");

      expect(result).toBe(false);
      expect(registry.isRegistered("task-1")).toBe(false);
    });
  });

  describe("isCancelling/setCancelling", () => {
    it("初期状態ではキャンセル中ではないこと", () => {
      expect(registry.isCancelling()).toBe(false);
    });

    it("キャンセル中フラグを設定できること", () => {
      registry.setCancelling(true);
      expect(registry.isCancelling()).toBe(true);

      registry.setCancelling(false);
      expect(registry.isCancelling()).toBe(false);
    });
  });

  describe("isRegistered", () => {
    it("登録されているタスクに対してtrueを返すこと", () => {
      const mockRun: CancellableWorkflowRun = { cancel: vi.fn() };
      registry.register("task-1", mockRun);

      expect(registry.isRegistered("task-1")).toBe(true);
    });

    it("登録されていないタスクに対してfalseを返すこと", () => {
      expect(registry.isRegistered("non-existent")).toBe(false);
    });
  });

  describe("clear", () => {
    it("全てのワークフロー実行とフラグをクリアできること", () => {
      const mockRun1: CancellableWorkflowRun = { cancel: vi.fn() };
      const mockRun2: CancellableWorkflowRun = { cancel: vi.fn() };
      registry.register("task-1", mockRun1);
      registry.register("task-2", mockRun2);
      registry.setCancelling(true);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.isCancelling()).toBe(false);
    });
  });

  describe("統合シナリオ", () => {
    it("レビュー対象削除時のワークフローキャンセルフロー", async () => {
      // 1. ワークフロー実行を登録
      const mockRun: CancellableWorkflowRun = {
        cancel: vi.fn().mockResolvedValue(undefined),
      };
      registry.register("review-task-1", mockRun);

      // 2. キャンセル中フラグを設定（新規デキューをブロック）
      registry.setCancelling(true);
      expect(registry.isCancelling()).toBe(true);

      // 3. ワークフローをキャンセル
      const cancelResult = await registry.cancel("review-task-1");
      expect(cancelResult).toBe(true);
      expect(registry.isRegistered("review-task-1")).toBe(false);

      // 4. キャンセル中フラグを解除
      registry.setCancelling(false);
      expect(registry.isCancelling()).toBe(false);
    });

    it("複数タスクの順次キャンセル", async () => {
      const mockRun1: CancellableWorkflowRun = {
        cancel: vi.fn().mockResolvedValue(undefined),
      };
      const mockRun2: CancellableWorkflowRun = {
        cancel: vi.fn().mockResolvedValue(undefined),
      };
      registry.register("task-1", mockRun1);
      registry.register("task-2", mockRun2);

      registry.setCancelling(true);

      await registry.cancel("task-1");
      await registry.cancel("task-2");

      registry.setCancelling(false);

      expect(registry.size()).toBe(0);
      expect(mockRun1.cancel).toHaveBeenCalled();
      expect(mockRun2.cancel).toHaveBeenCalled();
    });
  });
});
