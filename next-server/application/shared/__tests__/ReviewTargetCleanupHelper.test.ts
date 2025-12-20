import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewTargetCleanupHelper } from "../ReviewTargetCleanupHelper";
import type { IAiTaskRepository } from "@/application/shared/port/repository";
import type { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import type { IWorkflowRunRegistry } from "@/application/aiTask/WorkflowRunRegistry";
import { ReviewTarget } from "@/domain/reviewTarget";
import { AiTask } from "@/domain/aiTask";
import { TaskFileHelper } from "@/lib/server/taskFileHelper";
import { ReviewCacheHelper } from "@/lib/server/reviewCacheHelper";

// TaskFileHelperのモック
vi.mock("@/lib/server/taskFileHelper", () => ({
  TaskFileHelper: {
    deleteTaskFiles: vi.fn().mockResolvedValue(undefined),
  },
}));

// ReviewCacheHelperのモック
vi.mock("@/lib/server/reviewCacheHelper", () => ({
  ReviewCacheHelper: {
    deleteCacheDirectory: vi.fn().mockResolvedValue(undefined),
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

describe("ReviewTargetCleanupHelper", () => {
  // テスト用ID
  const testReviewSpaceId = "550e8400-e29b-41d4-a716-446655440001";
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440002";
  const testAiTaskId = "550e8400-e29b-41d4-a716-446655440003";
  const testChecklistTaskId = "550e8400-e29b-41d4-a716-446655440004";
  const now = new Date();

  // テスト用エンティティ
  const createTestReviewTarget = () =>
    ReviewTarget.reconstruct({
      id: testReviewTargetId,
      reviewSpaceId: testReviewSpaceId,
      name: "テストレビュー対象",
      status: "completed",
      reviewType: "small",
      reviewSettings: null,
      createdAt: now,
      updatedAt: now,
    });

  const createTestAiTask = (status: string) =>
    AiTask.reconstruct({
      id: testAiTaskId,
      taskType: "small_review",
      status,
      apiKeyHash: "test-api-key-hash",
      priority: 1,
      payload: { reviewTargetId: testReviewTargetId },
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: status === "processing" ? now : null,
      completedAt: null,
      fileMetadata: [],
    });

  const createTestChecklistTask = (status: string) =>
    AiTask.reconstruct({
      id: testChecklistTaskId,
      taskType: "checklist_generation",
      status,
      apiKeyHash: "test-api-key-hash",
      priority: 1,
      payload: { reviewSpaceId: testReviewSpaceId },
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: status === "processing" ? now : null,
      completedAt: null,
      fileMetadata: [],
    });

  // モックリポジトリ
  let mockReviewTargetRepository: IReviewTargetRepository;
  let mockAiTaskRepository: IAiTaskRepository;
  let mockWorkflowRunRegistry: IWorkflowRunRegistry;
  let helper: ReviewTargetCleanupHelper;
  let helperWithRegistry: ReviewTargetCleanupHelper;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReviewTargetRepository = {
      findById: vi.fn(),
      findByReviewSpaceId: vi.fn().mockResolvedValue([createTestReviewTarget()]),
      countByReviewSpaceId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockAiTaskRepository = {
      findById: vi.fn(),
      findByStatus: vi.fn(),
      findByApiKeyHashAndStatus: vi.fn(),
      findDistinctApiKeyHashesInQueue: vi.fn(),
      countQueuedByApiKeyHash: vi.fn(),
      dequeueNextTask: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      deleteByStatus: vi.fn(),
      findByReviewTargetId: vi.fn().mockResolvedValue(null),
      deleteByReviewTargetId: vi.fn(),
      findChecklistGenerationTaskByReviewSpaceId: vi.fn().mockResolvedValue(null),
      deleteChecklistGenerationTaskByReviewSpaceId: vi.fn(),
    };

    mockWorkflowRunRegistry = {
      register: vi.fn(),
      deregister: vi.fn(),
      cancel: vi.fn().mockResolvedValue(true),
      isRegistered: vi.fn(),
      isCancelling: vi.fn(),
      setCancelling: vi.fn(),
    };

    helper = new ReviewTargetCleanupHelper(
      mockReviewTargetRepository,
      mockAiTaskRepository,
    );

    helperWithRegistry = new ReviewTargetCleanupHelper(
      mockReviewTargetRepository,
      mockAiTaskRepository,
      mockWorkflowRunRegistry,
    );
  });

  describe("cleanupReviewTargets", () => {
    it("レビュースペース内の全レビュー対象をクリーンアップする", async () => {
      await helper.cleanupReviewTargets(testReviewSpaceId);

      // レビュー対象が取得されたことを確認
      expect(mockReviewTargetRepository.findByReviewSpaceId).toHaveBeenCalled();
      // キャッシュ削除が呼ばれたことを確認
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        testReviewTargetId,
      );
    });

    it("AIタスクが存在する場合、ファイルとタスクが削除される", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask("queued"),
      );

      await helper.cleanupReviewTargets(testReviewSpaceId);

      // タスクファイルが削除されたことを確認
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(testAiTaskId);
      // AIタスクが削除されたことを確認
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalledWith(
        testReviewTargetId,
      );
    });

    it("PROCESSING状態のAIタスクがある場合、ワークフローがキャンセルされる", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask("processing"),
      );

      await helperWithRegistry.cleanupReviewTargets(testReviewSpaceId);

      // キャンセル中フラグが設定・解除されることを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenNthCalledWith(1, true);
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenNthCalledWith(2, false);
      // ワークフローがキャンセルされたことを確認
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledWith(testAiTaskId);
    });

    it("QUEUED状態のAIタスクの場合、ワークフローキャンセルは呼ばれない", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask("queued"),
      );

      await helperWithRegistry.cleanupReviewTargets(testReviewSpaceId);

      // ワークフローキャンセルは呼ばれない
      expect(mockWorkflowRunRegistry.cancel).not.toHaveBeenCalled();
      // タスク削除は呼ばれる
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalled();
    });

    it("キャッシュ削除に失敗してもエラーにならない", async () => {
      vi.mocked(ReviewCacheHelper.deleteCacheDirectory).mockRejectedValue(
        new Error("キャッシュ削除失敗"),
      );

      // エラーにならずに完了する
      await expect(
        helper.cleanupReviewTargets(testReviewSpaceId),
      ).resolves.toBeUndefined();
    });

    it("タスクファイル削除に失敗してもエラーにならない", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask("queued"),
      );
      vi.mocked(TaskFileHelper.deleteTaskFiles).mockRejectedValue(
        new Error("ファイル削除失敗"),
      );

      // エラーにならずに完了する
      await expect(
        helper.cleanupReviewTargets(testReviewSpaceId),
      ).resolves.toBeUndefined();
      // AIタスク削除は続行される
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalled();
    });

    it("ワークフローキャンセルに失敗してもエラーにならない", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask("processing"),
      );
      vi.mocked(mockWorkflowRunRegistry.cancel).mockRejectedValue(
        new Error("キャンセル失敗"),
      );

      // エラーにならずに完了する
      await expect(
        helperWithRegistry.cleanupReviewTargets(testReviewSpaceId),
      ).resolves.toBeUndefined();
      // キャンセル中フラグが解除されることを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenLastCalledWith(false);
    });
  });

  describe("cleanupSingleReviewTarget", () => {
    it("単一のレビュー対象をクリーンアップする", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask("completed"),
      );

      await helper.cleanupSingleReviewTarget(testReviewTargetId);

      // タスクファイル削除が呼ばれたことを確認
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(testAiTaskId);
      // AIタスク削除が呼ばれたことを確認
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalledWith(
        testReviewTargetId,
      );
      // キャッシュ削除が呼ばれたことを確認
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        testReviewTargetId,
      );
    });

    it("AIタスクがない場合でもキャッシュは削除される", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(null);

      await helper.cleanupSingleReviewTarget(testReviewTargetId);

      // キャッシュ削除は呼ばれる
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        testReviewTargetId,
      );
      // タスク関連は呼ばれない
      expect(TaskFileHelper.deleteTaskFiles).not.toHaveBeenCalled();
      expect(mockAiTaskRepository.deleteByReviewTargetId).not.toHaveBeenCalled();
    });
  });

  describe("cleanupChecklistGenerationTask", () => {
    it("チェックリスト生成タスクをクリーンアップする", async () => {
      vi.mocked(
        mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId,
      ).mockResolvedValue(createTestChecklistTask("completed"));

      await helper.cleanupChecklistGenerationTask(testReviewSpaceId);

      // タスクファイル削除が呼ばれたことを確認
      expect(TaskFileHelper.deleteTaskFiles).toHaveBeenCalledWith(
        testChecklistTaskId,
      );
      // チェックリスト生成タスク削除が呼ばれたことを確認
      expect(
        mockAiTaskRepository.deleteChecklistGenerationTaskByReviewSpaceId,
      ).toHaveBeenCalledWith(testReviewSpaceId);
    });

    it("PROCESSING状態のチェックリスト生成タスクがある場合、ワークフローがキャンセルされる", async () => {
      vi.mocked(
        mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId,
      ).mockResolvedValue(createTestChecklistTask("processing"));

      await helperWithRegistry.cleanupChecklistGenerationTask(testReviewSpaceId);

      // キャンセル中フラグが設定・解除されることを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenNthCalledWith(1, true);
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenNthCalledWith(2, false);
      // ワークフローがキャンセルされたことを確認
      expect(mockWorkflowRunRegistry.cancel).toHaveBeenCalledWith(
        testChecklistTaskId,
      );
    });

    it("チェックリスト生成タスクがない場合は何もしない", async () => {
      vi.mocked(
        mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId,
      ).mockResolvedValue(null);

      await helper.cleanupChecklistGenerationTask(testReviewSpaceId);

      // 何も呼ばれない
      expect(TaskFileHelper.deleteTaskFiles).not.toHaveBeenCalled();
      expect(
        mockAiTaskRepository.deleteChecklistGenerationTaskByReviewSpaceId,
      ).not.toHaveBeenCalled();
    });

    it("チェックリストワークフローキャンセルに失敗してもエラーにならない", async () => {
      vi.mocked(
        mockAiTaskRepository.findChecklistGenerationTaskByReviewSpaceId,
      ).mockResolvedValue(createTestChecklistTask("processing"));
      vi.mocked(mockWorkflowRunRegistry.cancel).mockRejectedValue(
        new Error("キャンセル失敗"),
      );

      // エラーにならずに完了する
      await expect(
        helperWithRegistry.cleanupChecklistGenerationTask(testReviewSpaceId),
      ).resolves.toBeUndefined();
      // キャンセル中フラグが解除されることを確認
      expect(mockWorkflowRunRegistry.setCancelling).toHaveBeenLastCalledWith(false);
    });
  });

  describe("WorkflowRunRegistryなしの場合", () => {
    it("WorkflowRunRegistryがない場合、PROCESSING状態でもワークフローキャンセルは呼ばれない", async () => {
      vi.mocked(mockAiTaskRepository.findByReviewTargetId).mockResolvedValue(
        createTestAiTask("processing"),
      );

      // WorkflowRunRegistryなしのhelperを使用
      await helper.cleanupReviewTargets(testReviewSpaceId);

      // ワークフローキャンセルは呼ばれない（registryがないため）
      expect(mockWorkflowRunRegistry.cancel).not.toHaveBeenCalled();
      // タスク削除は呼ばれる
      expect(mockAiTaskRepository.deleteByReviewTargetId).toHaveBeenCalled();
    });
  });

  describe("複数レビュー対象の処理", () => {
    it("複数のレビュー対象を順次クリーンアップする", async () => {
      const reviewTarget1 = createTestReviewTarget();
      const reviewTarget2Id = "550e8400-e29b-41d4-a716-446655440010";
      const reviewTarget2 = ReviewTarget.reconstruct({
        id: reviewTarget2Id,
        reviewSpaceId: testReviewSpaceId,
        name: "テストレビュー対象2",
        status: "completed",
        reviewType: "small",
        reviewSettings: null,
        createdAt: now,
        updatedAt: now,
      });

      vi.mocked(mockReviewTargetRepository.findByReviewSpaceId).mockResolvedValue([
        reviewTarget1,
        reviewTarget2,
      ]);

      await helper.cleanupReviewTargets(testReviewSpaceId);

      // 両方のレビュー対象のキャッシュが削除されたことを確認
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        testReviewTargetId,
      );
      expect(ReviewCacheHelper.deleteCacheDirectory).toHaveBeenCalledWith(
        reviewTarget2Id,
      );
    });
  });
});
